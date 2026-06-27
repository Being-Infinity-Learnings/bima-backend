const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const controller = require("./quiz-composition.controller");

/**
 * @swagger
 * tags:
 *   name: QuizComposition
 *   description: >
 *     Manage which questions belong to a quiz and their order.
 *     Requires ADMIN or AUTHOR role.
 */

/**
 * @swagger
 * /quiz-composition/{quizId}/questions:
 *   post:
 *     summary: Add questions to a quiz
 *     description: >
 *       Appends the supplied questions to the quiz. Each question is appended
 *       after existing ones (orderIndex continues from the current max).
 *       Duplicate questionIds are ignored.
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to add questions to
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddQuestionsToQuizRequest'
 *           example:
 *             questionIds:
 *               - "b1c2d3e4-0000-0000-0000-000000000001"
 *               - "b1c2d3e4-0000-0000-0000-000000000002"
 *     responses:
 *       201:
 *         description: Questions added — returns all QuizQuestionMap entries for this quiz (including newly added)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AddQuestionsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - quizId: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   questionId: "b1c2d3e4-0000-0000-0000-000000000001"
 *                   orderIndex: 0
 *                   question:
 *                     id: "b1c2d3e4-0000-0000-0000-000000000001"
 *                     questionText: "What is the capital of France?"
 *                     questionType: "SINGLE_CORRECT"
 *                     customTimer: 30
 *                     options:
 *                       - optionText: "Paris"
 *                         isCorrect: true
 *                         orderIndex: 0
 *       400:
 *         description: quizId missing, questionIds invalid, or questions not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role (requires ADMIN or AUTHOR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     summary: Get all questions in a quiz (ordered)
 *     description: >
 *       Returns the questions assigned to the quiz, sorted by `orderIndex` ascending.
 *       Each item includes the full question object with options.
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Ordered list of quiz questions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizQuestionsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - quizId: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   questionId: "b1c2d3e4-0000-0000-0000-000000000001"
 *                   orderIndex: 0
 *                   question:
 *                     id: "b1c2d3e4-0000-0000-0000-000000000001"
 *                     questionText: "What is the capital of France?"
 *                     questionType: "SINGLE_CORRECT"
 *                     mediaUrl: null
 *                     customTimer: 30
 *                     options:
 *                       - id: "c1d2e3f4-0000-0000-0000-000000000001"
 *                         optionText: "Paris"
 *                         isCorrect: true
 *                         orderIndex: 0
 *                 - quizId: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   questionId: "b1c2d3e4-0000-0000-0000-000000000002"
 *                   orderIndex: 1
 *                   question:
 *                     id: "b1c2d3e4-0000-0000-0000-000000000002"
 *                     questionText: "What is 2 + 2?"
 *                     questionType: "NUMERIC"
 *                     mediaUrl: null
 *                     customTimer: null
 *                     options: []
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role (requires ADMIN or AUTHOR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     description: >
 *       Removes the mapping between the quiz and the question.
 *       The question itself is NOT deleted from the question bank.
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the question to remove
 *         example: "b1c2d3e4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Question removed from quiz successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Question removed"
 *       400:
 *         description: IDs missing or question not assigned to this quiz
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role (requires ADMIN or AUTHOR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
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
 *     description: >
 *       Accepts a complete ordered list of question UUIDs and reassigns `orderIndex`
 *       values accordingly (0-based). Every question currently in the quiz must be
 *       included — missing or extra IDs will cause an error.
 *     tags: [QuizComposition]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReorderQuestionsRequest'
 *           example:
 *             questionIds:
 *               - "b1c2d3e4-0000-0000-0000-000000000002"
 *               - "b1c2d3e4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: quizId missing, questionIds incomplete, or a questionId not found in quiz
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient role (requires ADMIN or AUTHOR)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch(
  "/:quizId/questions/order",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.reorderQuizQuestions,
);

module.exports = router;
