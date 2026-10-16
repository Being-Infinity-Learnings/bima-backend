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

async function createQuestionsBulk(req, res) {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "An array of questions is required",
      });
    }

    if (questions.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Cannot upload more than 500 questions in a single batch",
      });
    }

    const errors = [];
    questions.forEach((q, idx) => {
      const rowNum = idx + 1;
      if (!q.questionText || !q.questionText.trim()) {
        errors.push(`Row ${rowNum}: Question text is required`);
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        errors.push(`Row ${rowNum}: At least 2 options are required`);
      } else {
        const correctCount = q.options.filter((o) => Boolean(o.isCorrect)).length;
        if (correctCount !== 1) {
          errors.push(
            `Row ${rowNum}: Exactly 1 correct answer is required (found ${correctCount})`,
          );
        }
        const hasEmptyOption = q.options.some(
          (o) => !o.optionText || !o.optionText.trim(),
        );
        if (hasEmptyOption) {
          errors.push(`Row ${rowNum}: All provided options must have text`);
        }
      }
      if (
        q.customTimer != null &&
        (isNaN(Number(q.customTimer)) || Number(q.customTimer) <= 0)
      ) {
        errors.push(`Row ${rowNum}: Custom timer must be a positive integer`);
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed for one or more questions",
        errors,
      });
    }

    const created = await questionService.createQuestionsBulk(
      questions,
      req.dbUser.id,
    );

    return res.status(201).json({
      success: true,
      message: `Successfully created ${created.length} question${created.length > 1 ? "s" : ""}`,
      data: created,
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
  createQuestionsBulk,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
};
