// Purpose: HTTP controllers for initializing and controlling quiz
// runtimes via REST endpoints used for debugging and administrative
// actions.
const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const { cancelQuizStart } = require("./runtime.queue");

// Map a thrown error to an HTTP response. Errors from runtime.state.js
// (NotFoundError, ConflictError, ValidationError) carry an explicit
// statusCode. Anything else is an unexpected/unclassified failure and
// is treated as a 500 rather than assumed to be the caller's fault.
function sendError(res, err) {
  const statusCode = err.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? "Internal server error" : err.message,
  });
}

// Initialize a runtime for a quiz (debug/admin only — in normal
// operation this happens automatically via the quiz-start BullMQ job).
// If a runtime already exists (e.g. from a previous test run), it is
// destroyed first so the new run always starts from a clean WAITING state.
// Also bypasses the SCHEDULED-only status check so a quiz that was left
// in LIVE or COMPLETED by a previous test can be re-initialized without
// needing to republish it.
async function initialize(req, res) {
  try {
    const { quizId } = req.params;

    // Tear down any leftover runtime (cancels pending phase jobs too).
    if (await manager.exists(quizId)) {
      await manager.destroy(quizId);
    }

    // ignoreStatus: true so this works on LIVE/COMPLETED quizzes that a
    // previous test run left in a non-SCHEDULED state.
    const initialState = await loader.load(quizId, { ignoreStatus: true });

    await manager.create(initialState);

    // Cancel the automatic BullMQ start job so it doesn't race with
    // the admin's manual start call.
    await cancelQuizStart(quizId);

    return res.json({
      success: true,

      data: {
        quizId,

        questionCount: initialState.questions.length,

        phase: initialState.phase,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

// Start an initialized runtime (mark quiz LIVE and begin the engine).
async function start(req, res) {
  try {
    const { quizId } = req.params;

    await manager.withEngine(quizId, (engine) => engine.start());

    return res.json({
      success: true,

      message: "Runtime started",
    });
  } catch (err) {
    return sendError(res, err);
  }
}

// Debug: submit an answer via HTTP to the runtime engine.
async function submitAnswer(req, res) {
  try {
    const { quizId } = req.params;

    // Same call the socket path uses (quiz.socket.js) — no lock needed
    // here either, for the same reason: engine.submitAnswer() is
    // self-sufficient via atomic Redis operations now.
    const result = await manager.withEngine(quizId, (engine) =>
      engine.submitAnswer({
        userId: req.user.id,
        questionId: req.body.questionId,
        selectedOptionIds: req.body.selectedOptionIds,
      }),
    );

    return res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return sendError(res, err);
  }
}

// Debug: fetch the current runtime state for inspecting behavior.
async function getRuntimeState(req, res) {
  try {
    const { quizId } = req.params;

    const engine = await manager.loadEngine(quizId);

    return res.json({
      success: true,

      data: await engine.getRuntimeState(),
    });
  } catch (err) {
    return sendError(res, err);
  }
}

module.exports = {
  initialize,
  start,
  submitAnswer,
  getRuntimeState,
};
