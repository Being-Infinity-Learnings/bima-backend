// Purpose: BullMQ queue that drives runtime phase transitions
// (lobby -> question -> reveal -> leaderboard -> ... -> completed).
// Replaces the old `setTimeout`/`this.runtime.timeoutHandle` approach,
// which lived in one process's memory and couldn't survive a restart or
// be picked up by a different instance. Every phase transition is now a
// delayed job; whichever instance's worker is free picks it up, reloads
// the quiz's state from Redis, and executes the transition.
//
// IMPORTANT: unlike quiz-start.queue.js, we do NOT use a fixed/reused
// BullMQ jobId per quiz here. schedulePhaseAction() is routinely called
// from WITHIN the handler of the phase job that's currently executing
// (e.g. enterQuestion's handler calls scheduleNext("finishQuestion", ...)
// before it returns) — at that moment the "current" job for this quiz is
// still active/locked. Reusing one fixed jobId in that situation causes
// two problems: (1) trying to cancel it throws "could not be removed
// because it is locked by another worker", and (2) even worse, adding a
// new job with an id that still belongs to an active job doesn't create
// a new delayed job at all — BullMQ just hands back the existing
// (already-active, about-to-finish) job, so the "next" transition is
// silently never actually scheduled. Instead, we let BullMQ generate a
// unique id per job, and separately track "the current pending job id"
// for each quiz in Redis so we can still cancel a genuinely pending
// (not yet active) job on demand — e.g. when a question finishes early
// because everyone already answered.
const { Queue } = require("bullmq");
const connection = require("../../config/redis");

const QUEUE_NAME = "quiz-phase";

const quizPhaseQueue = new Queue(QUEUE_NAME, { connection });

function pendingJobKey(quizId) {
  return `quiz:${quizId}:pending-phase-job`;
}

// Schedule the next phase-transition action for a quiz. Best-effort
// cancels whatever job was previously tracked as "pending" for this quiz
// first (used both for normal progression and for "finish early because
// everyone answered").
async function schedulePhaseAction(quizId, action, delayMs) {
  await cancelPhaseAction(quizId);

  const job = await quizPhaseQueue.add(
    action,
    { quizId, action },
    {
      delay: Math.max(delayMs, 0),
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3,
      backoff: { type: "fixed", delay: 2000 },
    },
  );

  await connection.set(pendingJobKey(quizId), job.id);
}

// Remove the job currently tracked as "pending" for this quiz, if any.
// If that job is already active (currently being processed — e.g. we're
// being called from within that very job's own handler as it schedules
// the next transition), BullMQ won't let us remove it since it holds a
// processing lock. That's fine: it's already running and will clean
// itself up automatically on completion (removeOnComplete: true), so
// there's nothing stale left behind either way.
async function cancelPhaseAction(quizId) {
  const key = pendingJobKey(quizId);
  const existingJobId = await connection.get(key);

  if (existingJobId) {
    const job = await quizPhaseQueue.getJob(existingJobId);

    if (job) {
      try {
        await job.remove();
      } catch (err) {
        console.warn(
          `[quiz-phase] could not remove job ${existingJobId} (likely already active): ${err.message}`,
        );
      }
    }
  }

  await connection.del(key);
}

module.exports = {
  quizPhaseQueue,
  schedulePhaseAction,
  cancelPhaseAction,
};
