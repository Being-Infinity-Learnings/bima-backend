// Purpose: HTTP controllers for initializing and controlling quiz
// runtimes via REST endpoints used for debugging and administrative
// actions.
const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const RuntimeEngine = require("./runtime.engine");

// Map a thrown error to an HTTP response. Errors from runtime.errors.js
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

// Initialize a runtime for a scheduled quiz.
async function initialize(req, res) {
  try {
    const { quizId } = req.params;

    if (manager.exists(quizId)) {
      return res.status(409).json({
        success: false,
        message: "Runtime already initialized",
      });
    }

    const runtime = await loader.load(quizId);

    const engine = new RuntimeEngine(runtime);

    manager.create(runtime, engine);

    return res.json({
      success: true,

      data: {
        quizId,

        questionCount: runtime.questions.length,

        phase: runtime.phase,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
}

// Start an initialized runtime (mark quiz LIVE and begin the engine).
async function start(req, res) {
  try {
    const engine = manager.requireEngine(req.params.quizId);

    await engine.start();

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
    const engine = manager.requireEngine(req.params.quizId);

    const result = await engine.submitAnswer({
      userId: req.user.id,
      questionId: req.body.questionId,
      selectedOptionIds: req.body.selectedOptionIds,
    });

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
    const engine = manager.requireEngine(req.params.quizId);

    return res.json({
      success: true,

      data: engine.getRuntimeState(),
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
