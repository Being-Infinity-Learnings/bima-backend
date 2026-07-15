// Purpose: Single BullMQ queue + worker for BOTH runtime scheduling
// needs:
//   - "start-quiz" jobs: initialize the runtime + start the engine when a
//     scheduled quiz's (scheduledStartTime - lobby time) arrives.
//   - phase-action jobs (enterQuestion / finishQuestion / enterLeaderboard /
//     enterResults / complete / ...): advance an already-running quiz's
//     phase, replacing the old setTimeout/timeoutHandle mechanism so phase
//     transitions survive restarts and can be processed by any instance.
//
// These used to be two separate Queues (each with its own idle-polling
// Worker). Merging them into one queue halves the constant idle-polling
// Redis traffic (BZPOPMIN marker waits, delayed-set checks, stalled-job
// scans) that BullMQ Workers run forever regardless of whether any job
// actually exists — see runtime.worker.js for the Worker side and its
// `concurrency` setting, which is what keeps a slow/rare "start-quiz" job
// from ever blocking a time-sensitive "phase" job for a different quiz.
//
// Distinct job-id schemes let the two kinds of job still be
// looked-up/cancelled independently even though they now share one queue:
//   - start-quiz jobs use a deterministic jobId (quiz-start-{quizId}), so
//     "reschedule"/"cancel" is just remove-then-add / remove, from ANY
//     instance, with no extra bookkeeping needed.
//   - phase-action jobs get a BullMQ-generated id every time (see the
//     comment on schedulePhaseAction below for why a fixed id doesn't work
//     here), so the "currently pending phase job" id for each quiz is
//     tracked separately in a small Redis key.
const { Queue } = require("bullmq");
const redis = require("../../config/redis");

const QUEUE_NAME = "quiz-runtime";

const runtimeQueue = new Queue(QUEUE_NAME, {
  connection: redis.createBullConnection(),
});

// ---- start-quiz jobs ----

function startJobId(quizId) {
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

  await runtimeQueue.add(
    "start-quiz",
    { quizId },
    {
      jobId: startJobId(quizId),
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
  const job = await runtimeQueue.getJob(startJobId(quizId));
  if (job) {
    await job.remove();
  }
}

// ---- phase-action jobs ----

function pendingPhaseJobKey(quizId) {
  return `quiz:${quizId}:pending-phase-job`;
}

// Schedule the next phase-transition action for a quiz. Best-effort
// cancels whatever job was previously tracked as "pending" for this quiz
// first (used both for normal progression and for "finish early because
// everyone answered").
//
// IMPORTANT: unlike start-quiz, we do NOT use a fixed/reused jobId here.
// schedulePhaseAction() is routinely called from WITHIN the handler of
// the phase job that's currently executing (e.g. enterQuestion's handler
// calls scheduleNext("finishQuestion", ...) before it returns) — at that
// moment the "current" job for this quiz is still active/locked. Reusing
// one fixed jobId in that situation causes two problems: (1) trying to
// cancel it throws "could not be removed because it is locked by another
// worker", and (2) even worse, adding a new job with an id that still
// belongs to an active job doesn't create a new delayed job at all —
// BullMQ just hands back the existing (already-active, about-to-finish)
// job, so the "next" transition is silently never actually scheduled.
// Instead, we let BullMQ generate a unique id per job, and separately
// track "the current pending job id" for each quiz in Redis so we can
// still cancel a genuinely pending (not yet active) job on demand — e.g.
// when a question finishes early because everyone already answered.
async function schedulePhaseAction(quizId, action, delayMs) {
  await cancelPhaseAction(quizId);

  const job = await runtimeQueue.add(
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

  await redis.set(pendingPhaseJobKey(quizId), job.id);
}

// Remove the job currently tracked as "pending" for this quiz, if any.
// If that job is already active (currently being processed — e.g. we're
// being called from within that very job's own handler as it schedules
// the next transition), BullMQ won't let us remove it since it holds a
// processing lock. That's fine: it's already running and will clean
// itself up automatically on completion (removeOnComplete: true), so
// there's nothing stale left behind either way.
async function cancelPhaseAction(quizId) {
  const key = pendingPhaseJobKey(quizId);
  const existingJobId = await redis.get(key);

  if (existingJobId) {
    const job = await runtimeQueue.getJob(existingJobId);

    if (job) {
      try {
        await job.remove();
      } catch (err) {
        console.warn(
          `[quiz-runtime] could not remove job ${existingJobId} (likely already active): ${err.message}`,
        );
      }
    }
  }

  await redis.del(key);
}

module.exports = {
  runtimeQueue,

  scheduleQuizStart,
  cancelQuizStart,

  schedulePhaseAction,
  cancelPhaseAction,
};
