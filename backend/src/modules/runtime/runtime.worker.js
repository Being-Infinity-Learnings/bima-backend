// Purpose: BullMQ workers for the two runtime queues:
//   - "quiz-start": initializes the runtime + starts the engine when a
//     scheduled quiz's (scheduledStartTime - lobby time) arrives.
//   - "quiz-phase": advances an already-running quiz's phase
//     (enterQuestion / finishQuestion / enterLeaderboard / enterResults /
//     complete) — this replaces the old setTimeout/timeoutHandle
//     mechanism so phase transitions survive restarts and can be
//     processed by any instance, not just the one that scheduled them.
//
// Require this module once at process boot (see server.js) to start
// consuming jobs. It's safe to run in the same process as the HTTP/socket
// server, or split into a dedicated worker process/deployment.
const { Worker } = require("bullmq");
const redis = require("../../config/redis");

const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const store = require("./runtime.store");
const RuntimeEngine = require("./runtime.engine");

const QUIZ_START_QUEUE = "quiz-start";
const QUIZ_PHASE_QUEUE = "quiz-phase";

// --- quiz-start worker ---

const quizStartWorker = new Worker(
  QUIZ_START_QUEUE,
  async (job) => {
    const { quizId } = job.data;

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
      console.warn(`[quiz-start] skipping ${quizId}: ${err.message}`);
      return;
    }

    await manager.create(initialState);

    await manager.withEngine(quizId, (engine) => engine.start());
  },
  { connection: redis.createBullConnection() },
);

quizStartWorker.on("failed", (job, err) => {
  console.error(`[quiz-start] job ${job?.id} failed:`, err.message);
});

// --- quiz-phase worker ---

const quizPhaseWorker = new Worker(
  QUIZ_PHASE_QUEUE,
  async (job) => {
    const { quizId, action } = job.data;

    if (typeof RuntimeEngine.prototype[action] !== "function") {
      throw new Error(`Unknown runtime action: ${action}`);
    }

    // Two phase jobs for the SAME quiz can legitimately both be picked
    // up around the same moment — e.g. the natural timer-expiry job is
    // already active/locked (and thus un-cancelable, see
    // quiz-phase.queue.js) at the exact instant maybeFinishQuestionEarly()
    // schedules an immediate follow-up job. Without a lock here, both
    // would run engine[action]() concurrently against the same
    // load-mutate-save state, which can double-advance the phase or
    // double-apply the finishing bonus. The same lock submitAnswer()
    // already uses (see quiz.socket.js) serializes this too, so only one
    // mutation touches this quiz's state at a time no matter which path
    // it came from.
    await store.withLock(quizId, () =>
      manager.withEngine(quizId, (engine) => engine[action]()),
    );
  },
  { connection: redis.createBullConnection() },
);

quizPhaseWorker.on("failed", (job, err) => {
  console.error(
    `[quiz-phase] job ${job?.id} (${job?.name}) failed:`,
    err.message,
  );
});

module.exports = {
  quizStartWorker,
  quizPhaseWorker,
};
