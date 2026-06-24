const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const controller = require("./quiz-composition.controller");

/**
 * @swagger
 * /quiz-composition/{quizId}/questions:
 *   post:
 *     summary: Add questions to a quiz
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Questions added
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post(
  "/:quizId/questions",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.addQuestionsToQuiz,
);

/**
 * @swagger
 * /quiz-composition/{quizId}/questions:
 *   get:
 *     summary: Get questions of a quiz
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: List of questions
 *       500:
 *         description: Server error
 */
router.get(
  "/:quizId/questions",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getQuizQuestions,
);

/**
 * @swagger
 * /quiz-composition/{quizId}/questions/{questionId}:
 *   delete:
 *     summary: Remove a question from a quiz
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Question removed
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.delete(
  "/:quizId/questions/:questionId",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.removeQuestionFromQuiz,
);

/**
 * @swagger
 * /quiz-composition/{quizId}/questions/order:
 *   patch:
 *     summary: Reorder questions in a quiz
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Order updated
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.patch(
  "/:quizId/questions/order",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.reorderQuizQuestions,
);

module.exports = router;
