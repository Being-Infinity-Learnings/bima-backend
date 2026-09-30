// Purpose: Redis-backed persistence for all quiz runtime data. This
// replaces the in-memory `activeQuizzes` Map and the per-runtime
// `leaderboard` / `submissions` / `connectedUsers` Map/Set instances that
// used to live on the Node process. Every app instance and worker process
// reads/writes the same keys, so runtime state now survives restarts and
// is visible to every instance behind a load balancer.
//
// Key layout (all namespaced by quizId):
//   quiz:{id}:state              - JSON blob: phase/timing/current question/
//                                  cached quiz+questions/results. Everything
//                                  that isn't the leaderboard/submissions/
//                                  connected-user set.
//   quiz:{id}:leaderboard        - ZSET, member=userId, score=composite
//                                  (score * 1e13 - aggregateTimeMs) so
//                                  ZREVRANGE gives a first-pass ordering in
//                                  O(log n). Exact tie-breaking (which also
//                                  needs joinedAt) is done in JS against the
//                                  meta hash below — see getLeaderboard().
//   quiz:{id}:leaderboard:meta   - HASH, field=userId, value=JSON
//                                  {score, aggregateTimeMs, joinedAt,
//                                  fullName, profileImage}
//   quiz:{id}:submissions        - HASH, field=userId, value=JSON submission
//                                  (current question only; cleared each
//                                  time a new question starts)
//   quiz:{id}:submissions:closed - flag (EXISTS check only), set the
//                                  instant finishQuestion() starts closing
//                                  out a question, cleared when the next
//                                  question opens. See closeSubmissions()
//                                  and SUBMIT_SCRIPT below for why this
//                                  is what lets submitAnswer() run without
//                                  the per-quiz lock.
//   quiz:{id}:connected          - SET of connected userIds
const redis = require("../../config/redis");

// The lock's own traffic (SET NX retries + release) gets a DEDICATED
// connection, separate from `redis` above — same reasoning as BullMQ
// getting its own connection in config/redis.js. Under real contention
// (hundreds+ of callers racing the same quiz's lock), every retry attempt
// and every successful holder's actual work (leaderboard update, state
// save, ...) used to queue on the SAME single TCP connection; a burst of
// simultaneous retries could sit ahead of the current holder's own release
// commands, extending how long the lock stayed held far past the real
// critical-section time and collapsing throughput for everyone. Isolating
// lock traffic here means a retry storm for one quiz can no longer delay
// that quiz's own holder, or any other quiz's unrelated Redis traffic.
const lockRedis = redis.createBullConnection();

// Releases the lock only if the caller still owns it (token match), in one
// atomic round trip — GET-then-DEL from two separate calls would leave a
// window where the key could be deleted by someone else in between.
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

// Atomically: reject a submission that arrives after the question has
// been closed OR a duplicate, optionally update the leaderboard
// (read-modify-write on the submitter's score/aggregate time), buffer the
// submission, and check whether every registered participant has now
// answered — all in ONE round trip. This is what submitAnswer() used to
// do as 7 separate calls (HEXISTS, HGET, HSET, ZADD, HSET, ZCARD, HLEN)
// while holding the per-quiz lock — see
// loadtest/quiz/ATOMIC-SUBMIT-CHANGE.md for the before/after.
//
// The closed-flag check (KEYS[4]) is what makes it safe for this to run
// WITHOUT the per-quiz lock at all (see loadtest/quiz/LOCK-REMOVAL.md):
// closeSubmissions() sets that flag as the very first thing
// finishQuestion() does, atomically, before it reads anything about who
// did/didn't submit. Redis processes commands one at a time, so whichever
// of "a late submission" or "the close" actually reaches Redis first
// determines the outcome deterministically — either this submission is
// recorded and finishQuestion will see it, or it's rejected here and
// finishQuestion never has to consider it. There's no window where both
// could happen, which is what used to require the lock to prevent
// finishQuestion's non-submitter credit from double-counting a
// submission that was still in flight.
//
// mode "score": updates the leaderboard — the normal case, every question
// except the last. mode "buffer": only stores the submission, no
// leaderboard write — the last question, where scoring is deferred to
// finalizeLastQuestion() so the top-10 finishing bonus can be applied
// first (unchanged from before this change).
//
// Returns -2 (question already closed — nothing written), -1 (ARGV[1]
// already had a submission — nothing written), 0 (written, not everyone
// has answered yet), or 1 (written, and this was the submission that
// completed the set for every registered participant).
const SUBMIT_SCRIPT = `
if redis.call("EXISTS", KEYS[4]) == 1 then
  return -2
end

if redis.call("HEXISTS", KEYS[3], ARGV[1]) == 1 then
  return -1
end

if ARGV[2] == "score" then
  local raw = redis.call("HGET", KEYS[1], ARGV[1])
  local entry
  if raw then
    entry = cjson.decode(raw)
  else
    entry = { score = 0, aggregateTimeMs = 0, joinedAt = ARGV[6], fullName = "", profileImage = cjson.null }
  end

  entry.score = entry.score + tonumber(ARGV[3])
  entry.aggregateTimeMs = entry.aggregateTimeMs + tonumber(ARGV[4])

  redis.call("HSET", KEYS[1], ARGV[1], cjson.encode(entry))
  redis.call("ZADD", KEYS[2], entry.score * tonumber(ARGV[7]) - entry.aggregateTimeMs, ARGV[1])
end

redis.call("HSET", KEYS[3], ARGV[1], ARGV[5])

local total = redis.call("ZCARD", KEYS[2])
local submitted = redis.call("HLEN", KEYS[3])

if total > 0 and submitted >= total then
  return 1
else
  return 0
end
`;

// Atomically: mark a user connected (idempotent) and, if this is their
// first join, create their leaderboard entry — then return the fresh
// connected count, all in ONE round trip. Replaces what joinQuiz used to
// do as up to 4 separate calls (SADD, HEXISTS, a REDUNDANT second HEXISTS
// inside the old registerParticipant, HSET, ZADD) plus a further
// redundant SCARD from getRuntimeState() right after — see
// loadtest/quiz/PERFORMANCE.md for the measured effect.
const JOIN_SCRIPT = `
redis.call("SADD", KEYS[1], ARGV[1])

if redis.call("HEXISTS", KEYS[2], ARGV[1]) == 0 then
  local entry = {
    score = 0,
    aggregateTimeMs = 0,
    joinedAt = ARGV[4],
    fullName = ARGV[2],
    profileImage = (ARGV[3] ~= "" and ARGV[3] or cjson.null),
  }
  redis.call("HSET", KEYS[2], ARGV[1], cjson.encode(entry))
  redis.call("ZADD", KEYS[3], 0, ARGV[1])
end

return redis.call("SCARD", KEYS[1])
`;

const COMPOSITE_MULTIPLIER = 1e13; // aggregateTimeMs is always << this

function keys(quizId) {
  return {
    state: `quiz:${quizId}:state`,
    leaderboard: `quiz:${quizId}:leaderboard`,
    leaderboardMeta: `quiz:${quizId}:leaderboard:meta`,
    submissions: `quiz:${quizId}:submissions`,
    submissionsClosed: `quiz:${quizId}:submissions:closed`,
    connected: `quiz:${quizId}:connected`,
  };
}

function compositeScore(score, aggregateTimeMs) {
  return score * COMPOSITE_MULTIPLIER - aggregateTimeMs;
}

// ---- Core state (phase/timing/current question/results) ----

// Every save bumps a version counter on the state itself. This is what
// lets joinQuiz/disconnect broadcast to the room WITHOUT holding the
// per-quiz lock (see runtime.manager.js's broadcastIfCurrent) — they can
// check "has this changed since I read it?" right before emitting,
// instead of needing a lock to guarantee they never race a phase
// transition's own (still-locked) save+broadcast.
async function saveState(quizId, state) {
  state.version = (state.version || 0) + 1;
  await redis.set(keys(quizId).state, JSON.stringify(state));
}

async function loadState(quizId) {
  const raw = await redis.get(keys(quizId).state);
  return raw ? JSON.parse(raw) : null;
}

async function stateExists(quizId) {
  const exists = await redis.exists(keys(quizId).state);
  return exists === 1;
}

// Remove every key associated with a quiz's runtime (state, leaderboard,
// submissions, connected users). Called when moving a quiz back to DRAFT,
// deleting it, or when a runtime completes.
async function deleteAll(quizId) {
  const k = keys(quizId);
  await redis.del(
    k.state,
    k.leaderboard,
    k.leaderboardMeta,
    k.submissions,
    k.submissionsClosed,
    k.connected,
  );
}

// ---- Leaderboard ----

// See JOIN_SCRIPT above for exactly what this does atomically. Returns
// the connected count right after this join, so callers (joinQuiz) don't
// need a separate connectedCount() round trip immediately after.
async function joinParticipant(quizId, userId, { fullName, profileImage }) {
  const k = keys(quizId);

  return redis.eval(
    JOIN_SCRIPT,
    3,
    k.connected,
    k.leaderboardMeta,
    k.leaderboard,
    userId,
    fullName,
    profileImage ?? "",
    new Date().toISOString(),
  );
}

// Add a score delta and an aggregate-time delta to a user's leaderboard
// entry, creating the entry with defaults if it doesn't exist yet.
// Returns the entry's new total score.
async function updateLeaderboard(
  quizId,
  userId,
  scoreDelta,
  aggregateTimeDeltaMs = 0,
) {
  const k = keys(quizId);

  const raw = await redis.hget(k.leaderboardMeta, userId);
  const entry = raw
    ? JSON.parse(raw)
    : {
        score: 0,
        aggregateTimeMs: 0,
        joinedAt: new Date().toISOString(),
        fullName: "",
        profileImage: null,
      };

  entry.score += scoreDelta;
  entry.aggregateTimeMs += aggregateTimeDeltaMs;

  await redis.hset(k.leaderboardMeta, userId, JSON.stringify(entry));
  await redis.zadd(
    k.leaderboard,
    compositeScore(entry.score, entry.aggregateTimeMs),
    userId,
  );

  return entry.score;
}

async function getLeaderboardEntry(quizId, userId) {
  const raw = await redis.hget(keys(quizId).leaderboardMeta, userId);
  return raw ? JSON.parse(raw) : null;
}

async function leaderboardSize(quizId) {
  return redis.zcard(keys(quizId).leaderboard);
}

async function getLeaderboardUserIds(quizId) {
  return redis.zrange(keys(quizId).leaderboard, 0, -1);
}

// Return every leaderboard entry, ranked by:
//   1. score, descending
//   2. aggregateTimeMs, ascending
//   3. joinedAt, ascending
// The ZSET's composite score gets us close in O(log n), but exact
// tie-breaking needs aggregateTimeMs/joinedAt from the meta hash, so for
// correctness we pull all entries and do the final sort in JS. Fine for
// realistic per-quiz participant counts; if a single quiz's participant
// count ever gets huge, this is the place to optimize.
async function getLeaderboard(quizId) {
  const k = keys(quizId);
  const userIds = await redis.zrevrange(k.leaderboard, 0, -1);

  if (userIds.length === 0) return [];

  const metas = await redis.hmget(k.leaderboardMeta, ...userIds);

  return userIds
    .map((userId, i) => {
      const entry = JSON.parse(metas[i]);
      return {
        userId,
        fullName: entry.fullName,
        profileImage: entry.profileImage,
        totalScore: entry.score,
        aggregateTimeMs: entry.aggregateTimeMs,
        joinedAt: new Date(entry.joinedAt),
      };
    })
    .sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (a.aggregateTimeMs !== b.aggregateTimeMs)
        return a.aggregateTimeMs - b.aggregateTimeMs;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    })
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

// ---- Submissions (current question only) ----

async function setSubmission(quizId, userId, submission) {
  await redis.hset(
    keys(quizId).submissions,
    userId,
    JSON.stringify(submission),
  );
}

async function getSubmission(quizId, userId) {
  const raw = await redis.hget(keys(quizId).submissions, userId);
  return raw ? JSON.parse(raw) : null;
}

async function hasSubmission(quizId, userId) {
  const exists = await redis.hexists(keys(quizId).submissions, userId);
  return exists === 1;
}

async function getAllSubmissions(quizId) {
  const raw = await redis.hgetall(keys(quizId).submissions);
  return Object.entries(raw).map(([userId, value]) => [
    userId,
    JSON.parse(value),
  ]);
}

async function submissionsCount(quizId) {
  return redis.hlen(keys(quizId).submissions);
}

// Called when a new question opens (enterQuestion) — clears last
// question's buffered submissions AND reopens submissions for the new
// one (deletes the closed flag closeSubmissions() set for the last
// question).
async function clearSubmissions(quizId) {
  const k = keys(quizId);
  await redis.del(k.submissions, k.submissionsClosed);
}

// Called once, as the very first thing finishQuestion() does — see
// SUBMIT_SCRIPT's comment above for why this ordering is what makes
// submitAnswer() safe without the per-quiz lock. Idempotent: setting an
// already-set flag is harmless, which matters if finishQuestion ever runs
// more than once for the same question (see runtime.worker.js's comment
// on two phase jobs both becoming active).
async function closeSubmissions(quizId) {
  await redis.set(keys(quizId).submissionsClosed, "1");
}

// See SUBMIT_SCRIPT above for exactly what this does atomically.
async function recordSubmission(
  quizId,
  userId,
  { mode, scoreDelta = 0, aggregateTimeDeltaMs = 0, submissionJson },
) {
  const k = keys(quizId);

  const result = await redis.eval(
    SUBMIT_SCRIPT,
    4,
    k.leaderboardMeta,
    k.leaderboard,
    k.submissions,
    k.submissionsClosed,
    userId,
    mode,
    scoreDelta,
    aggregateTimeDeltaMs,
    submissionJson,
    new Date().toISOString(),
    COMPOSITE_MULTIPLIER,
  );

  if (result === -2) {
    return { tooLate: true, duplicate: false, everyoneAnswered: false };
  }

  if (result === -1) {
    return { tooLate: false, duplicate: true, everyoneAnswered: false };
  }

  return { tooLate: false, duplicate: false, everyoneAnswered: result === 1 };
}

// ---- Connected users (lobby presence) ----
// Note: there's no addConnected() — that's now folded into
// joinParticipant()/JOIN_SCRIPT above, atomically with registration.

async function removeConnected(quizId, userId) {
  await redis.srem(keys(quizId).connected, userId);
}

async function connectedCount(quizId) {
  return redis.scard(keys(quizId).connected);
}

// ---- Simple distributed lock (used to serialize concurrent mutations
// on the same quiz across instances, e.g. two submitAnswer calls racing
// on different app instances) ----

async function withLock(
  quizId,
  fn,
  // retries*retryDelayMs ~= 6s give-up budget. The original defaults here
  // (20 * 50ms = ~1s) gave up almost immediately under any real concurrent
  // burst — see loadtest/PERFORMANCE.md for the measurements behind this
  // number: 6s is long enough that a genuine burst of a few thousand
  // concurrent submissions to one quiz mostly clears instead of erroring
  // out, without leaving a caller waiting indefinitely.
  { ttlMs = 4000, retries = 60, retryDelayMs = 100 } = {},
) {
  const lockKey = `quiz:${quizId}:lock`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;

  let acquired = false;
  for (let i = 0; i < retries; i++) {
    const result = await lockRedis.set(lockKey, token, "PX", ttlMs, "NX");
    if (result === "OK") {
      acquired = true;
      break;
    }
    // Jittered delay (0.5x-1.5x of retryDelayMs), not a fixed interval —
    // with a fixed delay, every one of N waiters retries on the exact same
    // tick, which just recreates the same thundering-herd burst every
    // retryDelayMs instead of spreading attempts out. The jitter keeps the
    // *average* wait (and so the overall ~retries*retryDelayMs give-up
    // budget) about the same as before; it only breaks the lockstep.
    const jitteredDelay = retryDelayMs * (0.5 + Math.random());
    await new Promise((r) => setTimeout(r, jitteredDelay));
  }

  if (!acquired) {
    throw new Error("Could not acquire runtime lock, please retry.");
  }

  try {
    return await fn();
  } finally {
    await lockRedis.eval(RELEASE_SCRIPT, 1, lockKey, token);
  }
}

module.exports = {
  saveState,
  loadState,
  stateExists,
  deleteAll,

  joinParticipant,
  updateLeaderboard,
  getLeaderboardEntry,
  leaderboardSize,
  getLeaderboardUserIds,
  getLeaderboard,

  setSubmission,
  getSubmission,
  hasSubmission,
  getAllSubmissions,
  submissionsCount,
  clearSubmissions,
  closeSubmissions,
  recordSubmission,

  removeConnected,
  connectedCount,

  withLock,
};
