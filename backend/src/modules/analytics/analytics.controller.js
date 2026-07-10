const analyticsService = require("./analytics.service");

/** GET /analytics/quizzes — list of all completed quizzes with summary stats */
async function getCompletedQuizzes(req, res) {
  try {
    const quizzes = await analyticsService.getCompletedQuizzes();
    return res.json({ success: true, data: quizzes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
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
    const data = await analyticsService.getQuizAnalytics(quizId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error(error);
    const status = error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
}

module.exports = { getCompletedQuizzes, getQuizAnalytics };
