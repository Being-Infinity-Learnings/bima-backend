const quizService = require("./quiz.service");

/** Create a new quiz */
async function createQuiz(req, res) {
  try {
    const { title, defaultTimer, scheduledStartTime } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }

    if (defaultTimer == null) {
      return res.status(400).json({
        success: false,
        message: "Default timer is required",
      });
    }

    if (!scheduledStartTime) {
      return res.status(400).json({
        success: false,
        message: "Scheduled start time is required",
      });
    }

    const quiz = await quizService.createQuiz(req.body, req.dbUser.id);

    return res.status(201).json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Retrieve all quizzes */
async function getQuizzes(req, res) {
  try {
    const quizzes = await quizService.getQuizzes();

    return res.json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Retrieve a quiz by its ID */
async function getQuizById(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    const quiz = await quizService.getQuizById(id);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: "Quiz not found",
      });
    }

    return res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Update an existing quiz */
async function updateQuiz(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    if (req.body.defaultTimer != null && req.body.defaultTimer <= 0) {
      return res.status(400).json({
        success: false,
        message: "Default timer must be greater than zero",
      });
    }

    const quiz = await quizService.updateQuiz(id, req.body);

    return res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Delete a quiz */
async function deleteQuiz(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    await quizService.deleteQuiz(id);

    return res.json({
      success: true,
      message: "Quiz deleted",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Publish a quiz */
async function publishQuiz(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    const quiz = await quizService.publishQuiz(id);

    return res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/** Unpublish a quiz */
async function unpublishQuiz(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }
    const quiz = await quizService.unpublishQuiz(id);

    return res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/** Add groups to a quiz */
async function addGroupsToQuiz(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    const result = await quizService.addGroupsToQuiz(quizId, req.body.groupIds);

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

/** Get groups associated with a quiz */
async function getQuizGroups(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }
    const groups = await quizService.getQuizGroups(quizId);

    return res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** Remove a group from a quiz */
async function removeGroupFromQuiz(req, res) {
  try {
    const { quizId } = req.params;

    if (!quizId) {
      return res.status(400).json({
        success: false,
        message: "Quiz ID is required",
      });
    }

    await quizService.removeGroupFromQuiz(quizId, req.params.groupId);

    return res.json({
      success: true,
      message: "Group removed",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/** Get quizzes that the user can access */
async function getMyQuizzes(req, res) {
  try {
    const quizzes = await quizService.getMyQuizzes(req.dbUser);

    return res.json({
      success: true,
      data: quizzes,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getMyQuizById(req, res) {
  try {
    const quiz = await quizService.getMyQuizById(req.params.quizId, req.dbUser);

    return res.json({
      success: true,
      data: quiz,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }
}

async function getMyHistory(req, res) {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const { results, pagination } = await quizService.getMyHistory(req.dbUser, {
      page,
      limit,
    });

    return res.json({
      success: true,
      data: results,
      pagination,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  createQuiz,
  getQuizzes,
  getQuizById,
  updateQuiz,
  deleteQuiz,
  publishQuiz,
  unpublishQuiz,
  addGroupsToQuiz,
  getQuizGroups,
  removeGroupFromQuiz,
  getMyQuizzes,
  getMyQuizById,
  getMyHistory,
};
