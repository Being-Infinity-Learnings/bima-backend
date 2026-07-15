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
//   quiz:{id}:connected          - SET of connected userIds
const redis = require("../../config/redis");

const COMPOSITE_MULTIPLIER = 1e13; // aggregateTimeMs is always << this

function keys(quizId) {
  return {
    state: `quiz:${quizId}:state`,
    leaderboard: `quiz:${quizId}:leaderboard`,
    leaderboardMeta: `quiz:${quizId}:leaderboard:meta`,
    submissions: `quiz:${quizId}:submissions`,
    connected: `quiz:${quizId}:connected`,
  };
}

function compositeScore(score, aggregateTimeMs) {
  return score * COMPOSITE_MULTIPLIER - aggregateTimeMs;
}

// ---- Core state (phase/timing/current question/results) ----

async function saveState(quizId, state) {
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
    k.connected,
  );
}

// ---- Leaderboard ----

async function hasLeaderboardEntry(quizId, userId) {
  const exists = await redis.hexists(keys(quizId).leaderboardMeta, userId);
  return exists === 1;
}

async function registerParticipant(quizId, userId, { fullName, profileImage }) {
  const k = keys(quizId);

  if (await hasLeaderboardEntry(quizId, userId)) return;

  const entry = {
    score: 0,
    aggregateTimeMs: 0,
    joinedAt: new Date().toISOString(),
    fullName,
    profileImage: profileImage ?? null,
  };

  await redis.hset(k.leaderboardMeta, userId, JSON.stringify(entry));
  await redis.zadd(k.leaderboard, compositeScore(0, 0), userId);
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

async function clearSubmissions(quizId) {
  await redis.del(keys(quizId).submissions);
}

// ---- Connected users (lobby presence) ----

async function addConnected(quizId, userId) {
  await redis.sadd(keys(quizId).connected, userId);
}

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
  { ttlMs = 4000, retries = 20, retryDelayMs = 50 } = {},
) {
  const lockKey = `quiz:${quizId}:lock`;
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;

  let acquired = false;
  for (let i = 0; i < retries; i++) {
    const result = await redis.set(lockKey, token, "PX", ttlMs, "NX");
    if (result === "OK") {
      acquired = true;
      break;
    }
    await new Promise((r) => setTimeout(r, retryDelayMs));
  }

  if (!acquired) {
    throw new Error("Could not acquire runtime lock, please retry.");
  }

  try {
    return await fn();
  } finally {
    // Only release if we still own it (best-effort; a Lua script would be
    // fully atomic, but the TTL already bounds worst-case lock lifetime).
    const current = await redis.get(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
}

module.exports = {
  saveState,
  loadState,
  stateExists,
  deleteAll,

  registerParticipant,
  hasLeaderboardEntry,
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

  addConnected,
  removeConnected,
  connectedCount,

  withLock,
};
