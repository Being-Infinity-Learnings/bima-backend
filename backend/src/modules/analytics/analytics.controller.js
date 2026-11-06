const analyticsService = require("./analytics.service");

/** GET /analytics/quizzes — list of all completed quizzes with summary stats */
async function getCompletedQuizzes(req, res) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    const search = (req.query.search ?? "").trim();

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const pageSize = Math.min(limit, 100);

    const result = await analyticsService.getCompletedQuizzes(
      page,
      pageSize,
      search,
    );

    return res.json({
      success: true,
      data: result.items,
      globalStats: result.globalStats,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/** GET /analytics/quizzes/:quizId — full analytics for one completed quiz */
async function getQuizAnalytics(req, res) {
  try {
    const { quizId } = req.params;
    if (!quizId) {
      return res
        .status(400)
        .json({ success: false, message: "Quiz ID is required" });
    }
    const section = req.query.section || "all";
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !["all", "leaderboard", "questions"].includes(section) ||
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid section, page, or limit",
      });
    }

    const data = await analyticsService.getQuizAnalytics(quizId, {
      section,
      page,
      limit: Math.min(limit, 100),
    });
    return res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { getCompletedQuizzes, getQuizAnalytics };
