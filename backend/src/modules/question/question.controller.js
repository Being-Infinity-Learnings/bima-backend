const questionService = require("./question.service");

async function createQuestion(req, res) {
  try {
    if (req.body.customTimer != null && req.body.customTimer <= 0) {
      return res.status(400).json({
        success: false,
        message: "Custom timer must be greater than zero",
      });
    }

    const question = await questionService.createQuestion(
      req.body,
      req.dbUser.id,
    );

    return res.status(201).json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getQuestions(req, res) {
  try {
    const questions = await questionService.getQuestions();

    return res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getQuestionById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Question ID is required",
      });
    }

    const question = await questionService.getQuestionById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    return res.json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function updateQuestion(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Question ID is required",
      });
    }

    if (req.body.customTimer != null && req.body.customTimer <= 0) {
      return res.status(400).json({
        success: false,
        message: "Custom timer must be greater than zero",
      });
    }

    const question = await questionService.updateQuestion(id, req.body);

    return res.json({
      success: true,
      data: question,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function deleteQuestion(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Question ID is required",
      });
    }

    await questionService.deleteQuestion(id);

    return res.json({
      success: true,
      message: "Question deleted",
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
