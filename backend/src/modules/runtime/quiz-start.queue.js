// Purpose: BullMQ queue that triggers automatic quiz initialization +
// start. A job is scheduled the moment a quiz is published (moved to
// SCHEDULED), delayed so it fires at (scheduledStartTime - lobby time).
// A deterministic jobId per quiz lets "reschedule" and "cancel" be
// implemented as remove-then-add / remove, from ANY app instance.
const { Queue } = require("bullmq");
const redis = require("../../config/redis");

const QUEUE_NAME = "quiz-start";

// Dedicated connection for this queue — do not share the app's main
// Redis connection with BullMQ (see config/redis.js for why).
const quizStartQueue = new Queue(QUEUE_NAME, {
  connection: redis.createBullConnection(),
});

function jobId(quizId) {
  return `quiz-start-${quizId}`;
}

// Schedule (or reschedule) the job that will initialize the runtime and
// start a quiz. `lobbyMs` is subtracted from scheduledStartTime so the
// lobby finishes exactly at the scheduled time.
async function scheduleQuizStart(quizId, scheduledStartTime, lobbyMs) {
  await cancelQuizStart(quizId);

  const delay = Math.max(
    new Date(scheduledStartTime).getTime() - lobbyMs - Date.now(),
    0,
  );

  await quizStartQueue.add(
    "start-quiz",
    { quizId },
    {
      jobId: jobId(quizId),
      delay,
      removeOnComplete: true,
      removeOnFail: true,
      attempts: 3,
      backoff: { type: "fixed", delay: 5000 },
    },
  );
}

// Remove a pending (not-yet-fired) start job for a quiz, if any.
async function cancelQuizStart(quizId) {
  const job = await quizStartQueue.getJob(jobId(quizId));
  if (job) {
    await job.remove();
  }
}

module.exports = {
  quizStartQueue,
  scheduleQuizStart,
  cancelQuizStart,
  jobId,
};
