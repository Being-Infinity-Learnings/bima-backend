// Purpose: BullMQ queue that drives runtime phase transitions
// (lobby -> question -> reveal -> leaderboard -> ... -> completed).
// Replaces the old `setTimeout`/`this.runtime.timeoutHandle` approach,
// which lived in one process's memory and couldn't survive a restart or
// be picked up by a different instance. Every phase transition is now a
// delayed job; whichever instance's worker is free picks it up, reloads
// the quiz's state from Redis, and executes the transition.
const { Queue } = require("bullmq");
const connection = require("../../config/redis");

const QUEUE_NAME = "quiz-phase";

const quizPhaseQueue = new Queue(QUEUE_NAME, { connection });

function jobId(quizId) {
  // One pending phase-transition job per quiz at a time.
  return `quiz-phase-${quizId}`;
}

// Schedule the next phase-transition action for a quiz, cancelling any
// previously scheduled one first (used both for normal progression and
// for "finish early because everyone answered").
async function schedulePhaseAction(quizId, action, delayMs) {
  await cancelPhaseAction(quizId);

  await quizPhaseQueue.add(
    action,
    { quizId, action },
    {
      jobId: jobId(quizId),
      delay: Math.max(delayMs, 0),
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3,
      backoff: { type: "fixed", delay: 2000 },
    },
  );
}

async function cancelPhaseAction(quizId) {
  const job = await quizPhaseQueue.getJob(jobId(quizId));
  if (job) {
    await job.remove();
  }
}

module.exports = {
  quizPhaseQueue,
  schedulePhaseAction,
  cancelPhaseAction,
  jobId,
};
