const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth.middleware");
const allowRoles = require("../../middleware/role.middleware");
const controller = require("./analytics.controller");

/**
 * @swagger
 * tags:
 *   name: Analytics
 *   description: >
 *     Quiz analytics endpoints for completed quizzes, including summary statistics,
 *     question-level performance breakdowns, leaderboard rankings, and per-participant
 *     answer trails. Requires ADMIN or AUTHOR access.
 */

/**
 * @swagger
 * /analytics/quizzes:
 *   get:
 *     summary: Get summary analytics for all completed quizzes
 *     description: >
 *       Returns a list of all quizzes with status COMPLETED, including participant counts,
 *       total questions, average score, and submission totals. Useful for admin and author
 *       dashboards.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Completed quiz summary analytics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *                       title:
 *                         type: string
 *                         example: "General Knowledge Quiz"
 *                       description:
 *                         type: string
 *                         example: "A fun quiz on general knowledge topics."
 *                       coverImageUrl:
 *                         type: string
 *                         nullable: true
 *                       scheduledStartTime:
 *                         type: string
 *                         format: date-time
 *                       actualStartTime:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                       totalQuestions:
 *                         type: integer
 *                         example: 10
 *                       participantCount:
 *                         type: integer
 *                         example: 24
 *                       avgScore:
 *                         type: integer
 *                         example: 82
 *                       totalSubmissions:
 *                         type: integer
 *                         example: 22
 *             example:
 *               success: true
 *               data:
 *                 - id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   title: "General Knowledge Quiz"
 *                   description: "A fun quiz on general knowledge topics."
 *                   coverImageUrl: null
 *                   scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                   actualStartTime: "2026-07-01T10:05:00.000Z"
 *                   completedAt: "2026-07-01T10:20:00.000Z"
 *                   totalQuestions: 10
 *                   participantCount: 24
 *                   avgScore: 82
 *                   totalSubmissions: 22
 *       401:
 *         description: Missing or invalid Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       403:
 *         description: Insufficient role. Requires ADMIN or AUTHOR.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       500:
 *         description: Unexpected server error while loading analytics data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 */
router.get(
  "/quizzes",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getCompletedQuizzes,
);

/**
 * @swagger
 * /analytics/quizzes/{quizId}:
 *   get:
 *     summary: Get detailed analytics for a specific completed quiz
 *     description: >
 *       Returns full analytics for one completed quiz, including quiz metadata,
 *       question-by-question performance, leaderboard rankings, and a per-participant
 *       answer trail for deeper review.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         description: UUID of the completed quiz to analyze.
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Detailed quiz analytics retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     quiz:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                         coverImageUrl:
 *                           type: string
 *                           nullable: true
 *                         status:
 *                           type: string
 *                         scheduledStartTime:
 *                           type: string
 *                           format: date-time
 *                         actualStartTime:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         defaultTimer:
 *                           type: integer
 *                     summary:
 *                       type: object
 *                       properties:
 *                         participantCount:
 *                           type: integer
 *                         totalQuestions:
 *                           type: integer
 *                         totalSubmissions:
 *                           type: integer
 *                         avgScore:
 *                           type: integer
 *                         topScore:
 *                           type: integer
 *                     leaderboard:
 *                       type: array
 *                       items:
 *                         type: object
 *                     questions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     participantTrail:
 *                       type: array
 *                       items:
 *                         type: object
 *             example:
 *               success: true
 *               data:
 *                 quiz:
 *                   id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   title: "General Knowledge Quiz"
 *                   description: "A fun quiz on general knowledge topics."
 *                   coverImageUrl: null
 *                   status: "COMPLETED"
 *                   scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                   actualStartTime: "2026-07-01T10:05:00.000Z"
 *                   completedAt: "2026-07-01T10:20:00.000Z"
 *                   defaultTimer: 30
 *                 summary:
 *                   participantCount: 24
 *                   totalQuestions: 10
 *                   totalSubmissions: 22
 *                   avgScore: 82
 *                   topScore: 95
 *                 leaderboard:
 *                   - userId: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                     fullName: "Asha Patel"
 *                     email: "asha@example.com"
 *                     rollNumber: "2023001"
 *                     collegeName: "BIMA"
 *                     totalScore: 95
 *                     totalElapsedMs: 48000
 *                     answeredCount: 10
 *                     correctCount: 9
 *                     rank: 1
 *                 questions:
 *                   - orderIndex: 1
 *                     questionId: "q1"
 *                     questionText: "What is the capital of France?"
 *                     questionType: "MCQ"
 *                     mediaUrl: null
 *                     customTimer: null
 *                     totalAnswered: 22
 *                     correctCount: 20
 *                     incorrectCount: 2
 *                     accuracyPct: 91
 *                     avgElapsedMs: 12000
 *                     options:
 *                       - id: "opt1"
 *                         optionText: "Paris"
 *                         isCorrect: true
 *                         selectedCount: 20
 *                         selectedPct: 91
 *       400:
 *         description: Quiz ID is missing or invalid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       404:
 *         description: Quiz not found.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       401:
 *         description: Missing or invalid Bearer token.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       403:
 *         description: Insufficient role. Requires ADMIN or AUTHOR.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       500:
 *         description: Unexpected server error while loading analytics data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 */
router.get(
  "/quizzes/:quizId",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getQuizAnalytics,
);

module.exports = router;
