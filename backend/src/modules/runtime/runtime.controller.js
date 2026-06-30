const loader = require("./runtime.loader");
const manager = require("./runtime.manager");
const RuntimeEngine = require("./runtime.engine");

async function initialize(req, res) {
  try {
    const { quizId } = req.params;

    if (manager.exists(quizId)) {
      return res.status(400).json({
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
    return res.status(400).json({
      success: false,

      message: err.message,
    });
  }
}

async function start(req, res) {
  try {
    const engine = manager.requireEngine(req.params.quizId);

    await engine.start();

    return res.json({
      success: true,

      message: "Runtime started",
    });
  } catch (err) {
    return res.status(400).json({
      success: false,

      message: err.message,
    });
  }
}

//debug
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
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
}

//debug
async function getRuntimeState(req, res) {
  try {
    const engine = manager.requireEngine(req.params.quizId);

    return res.json({
      success: true,

      data: engine.getRuntimeState(),
    });
  } catch (err) {
    return res.status(400).json({
      success: false,

      message: err.message,
    });
  }
}

module.exports = {
  initialize,
  start,
  submitAnswer,
  getRuntimeState,
};
