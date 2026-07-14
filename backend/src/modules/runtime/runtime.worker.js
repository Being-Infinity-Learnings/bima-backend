// Purpose: Single BullMQ worker for the merged "quiz-runtime" queue,
// handling both kinds of job:
//   - "start-quiz": initializes the runtime + starts the engine when a
//     scheduled quiz's (scheduledStartTime - lobby time) arrives.
//   - phase-action jobs (enterQuestion / finishQuestion / enterLeaderboard /
//     enterResults / complete): advance an already-running quiz's phase.
//
// Require this module once at process boot (see server.js) to start
// consuming jobs. It's safe to run in the same process as the HTTP/socket
// server, or split into a dedicated worker process/deployment.
//
// Previously this was TWO Workers (one per queue), each running its own
// independent idle-poll loop (BZPOPMIN marker wait + delayed-set check on
// every `drainDelay`, plus a stalled-job scan on every `stalledInterval`)
// forever, regardless of whether any job existed. That idle overhead is
// pure BullMQ bookkeeping — Redis has no "wake me up at timestamp X"
// primitive, so *some* periodic check is unavoidable for delayed jobs,
// but running it twice in parallel was pure waste. Merging into one
// Worker halves it outright, and the tuned intervals below (see
// `drainDelay` / `stalledInterval`) cut the rest further — quiz phase
// timing precision comes from the `delay` set on each job, not from how
// often the idle-check runs, so this doesn't cost any real responsiveness.
//
// `concurrency` is what keeps this safe to merge: a rare/slow "start-quiz"
// job for one quiz will never block a time-sensitive phase job for a
// DIFFERENT quiz, since the worker can process several jobs in parallel.
// Two phase jobs racing on the SAME quiz are still serialized correctly —
// that's handled by store.withLock below, exactly as before.
const { Worker } = require("bullmq");
const redis = require("../../config/redis");

const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const store = require("./runtime.store");
const RuntimeEngine = require("./runtime.engine");

const QUEUE_NAME = "quiz-runtime";

async function handleStartQuiz(quizId) {
  // Already initialized (e.g. an admin manually started it, or a retry
  // landed after a previous attempt partially succeeded) — nothing to do.
  if (await manager.exists(quizId)) {
    return;
  }

  // loader.load() throws ValidationError if the quiz is no longer
  // SCHEDULED (e.g. it was moved back to DRAFT after this job was
  // enqueued but before it fired) — that's a legitimate "skip", not a
  // job failure worth retrying, so we swallow that specific case.
  let initialState;
  try {
    initialState = await loader.load(quizId);
  } catch (err) {
    console.warn(`[quiz-runtime] skipping start for ${quizId}: ${err.message}`);
    return;
  }

  await manager.create(initialState);

  await manager.withEngine(quizId, (engine) => engine.start());
}

async function handlePhaseAction(quizId, action) {
  if (typeof RuntimeEngine.prototype[action] !== "function") {
    throw new Error(`Unknown runtime action: ${action}`);
  }

  // Two phase jobs for the SAME quiz can legitimately both be picked up
  // around the same moment — e.g. the natural timer-expiry job is already
  // active/locked (and thus un-cancelable, see runtime.queue.js) at the
  // exact instant maybeFinishQuestionEarly() schedules an immediate
  // follow-up job. Without a lock here, both would run engine[action]()
  // concurrently against the same load-mutate-save state, which can
  // double-advance the phase or double-apply the finishing bonus. The
  // same lock submitAnswer() already uses (see quiz.socket.js) serializes
  // this too, so only one mutation touches this quiz's state at a time
  // no matter which path it came from.
  await store.withLock(quizId, () =>
    manager.withEngine(quizId, (engine) => engine[action]()),
  );
}

const runtimeWorker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const { quizId } = job.data;

    if (job.name === "start-quiz") {
      return handleStartQuiz(quizId);
    }

    return handlePhaseAction(quizId, job.name);
  },
  {
    connection: redis.createBullConnection(),

    // Different quizzes' jobs never need to wait on each other; only same-
    // quiz mutations are serialized (via store.withLock, above).
    concurrency: 10,

    // How long the worker blocks waiting for a new job before re-checking
    // the delayed-job set on its own. Quiz phase timing precision comes
    // from each job's own `delay`, not from this — raising it just cuts
    // idle-check overhead when nothing is scheduled.
    drainDelay: 30,

    // How often it scans for stalled jobs. 30s (BullMQ's default) is
    // overkill for a low-traffic app with fast, idempotent-ish handlers;
    // 2 minutes is still fast enough to recover from a crashed worker
    // well before it'd be noticeable.
    stalledInterval: 120000,
  },
);

runtimeWorker.on("failed", (job, err) => {
  console.error(
    `[quiz-runtime] job ${job?.id} (${job?.name}) failed:`,
    err.message,
  );
});

module.exports = {
  runtimeWorker,
};
