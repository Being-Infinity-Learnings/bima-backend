// Purpose: HTTP controllers for initializing and controlling quiz
// runtimes via REST endpoints used for debugging and administrative
// actions.
const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const store = require("./runtime.store");
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

// Initialize a runtime for a scheduled quiz (debug/admin only — in normal
// operation this happens automatically via the quiz-start BullMQ job).
async function initialize(req, res) {
  try {
    const { quizId } = req.params;

    if (await manager.exists(quizId)) {
      return res.status(409).json({
        success: false,
        message: "Runtime already initialized",
      });
    }

    const initialState = await loader.load(quizId);

    await manager.create(initialState);

    // A manual initialize should also cancel the automatic BullMQ start
    // job, since we don't want both racing to start the same quiz.
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

    // Same lock the socket path uses (quiz.socket.js) — this debug HTTP
    // endpoint mutates the same runtime state and must not be allowed to
    // race a real submission coming in over the socket at the same time.
    const result = await store.withLock(quizId, () =>
      manager.withEngine(quizId, (engine) =>
        engine.submitAnswer({
          userId: req.user.id,
          questionId: req.body.questionId,
          selectedOptionIds: req.body.selectedOptionIds,
        }),
      ),
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
