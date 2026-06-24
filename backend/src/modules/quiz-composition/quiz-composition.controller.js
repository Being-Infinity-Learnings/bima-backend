const service = require("./quiz-composition.service");

/** Add questions to a quiz */
async function addQuestionsToQuiz(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    const result = await service.addQuestionsToQuiz(
      quizId,
      req.body.questionIds,
    );

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/** Get questions of a quiz */
async function getQuizQuestions(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    const data = await service.getQuizQuestions(quizId);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Remove a question from a quiz */
async function removeQuestionFromQuiz(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    await service.removeQuestionFromQuiz(quizId, req.params.questionId);

    return res.json({
      success: true,
      message: "Question removed",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/** Reorder questions in a quiz */
async function reorderQuizQuestions(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    await service.reorderQuizQuestions(quizId, req.body.questionIds);

    return res.json({
      success: true,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  addQuestionsToQuiz,
  getQuizQuestions,
  removeQuestionFromQuiz,
  reorderQuizQuestions,
};
