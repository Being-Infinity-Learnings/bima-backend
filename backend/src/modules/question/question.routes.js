const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");
const allowRoles = require("../../middleware/role.middleware");

const controller = require("./question.controller");

/**
 * @swagger
 * tags:
 *   name: Question
 *   description: Question bank management — create, read, update, and delete questions. Requires ADMIN or AUTHOR role.
 */

/**
 * @swagger
 * /question:
 *   post:
 *     summary: Create a new question
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionCreate'
 *           example:
 *             questionText: "What is the capital of France?"
 *             questionType: "SINGLE_CORRECT"
 *             customTimer: 30
 *             options:
 *               - optionText: "Paris"
 *                 isCorrect: true
 *                 orderIndex: 0
 *               - optionText: "Berlin"
 *                 isCorrect: false
 *                 orderIndex: 1
 *               - optionText: "Madrid"
 *                 isCorrect: false
 *                 orderIndex: 2
 *               - optionText: "Rome"
 *                 isCorrect: false
 *                 orderIndex: 3
 *     responses:
 *       201:
 *         description: Question created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuestionResponse'
 *       400:
 *         description: Validation error (e.g. customTimer ≤ 0)
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
  "/",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.createQuestion,
);

/**
 * @swagger
 * /question:
 *   get:
 *     summary: Retrieve all questions in the question bank
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all questions with their options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuestionsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "b1c2d3e4-0000-0000-0000-000000000001"
 *                   questionText: "What is the capital of France?"
 *                   questionType: "SINGLE_CORRECT"
 *                   mediaUrl: null
 *                   customTimer: 30
 *                   createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                   options:
 *                     - id: "c1d2e3f4-0000-0000-0000-000000000001"
 *                       questionId: "b1c2d3e4-0000-0000-0000-000000000001"
 *                       optionText: "Paris"
 *                       isCorrect: true
 *                       orderIndex: 0
 *                   createdAt: "2026-06-24T09:00:00.000Z"
 *                   updatedAt: "2026-06-24T09:00:00.000Z"
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
router.get("/", auth, allowRoles("ADMIN", "AUTHOR"), controller.getQuestions);

/**
 * @swagger
 * /question/{id}:
 *   get:
 *     summary: Retrieve a single question by ID
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the question
 *         example: "b1c2d3e4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Question found — returns the question with all its options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuestionResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "b1c2d3e4-0000-0000-0000-000000000001"
 *                 questionText: "What is the capital of France?"
 *                 questionType: "SINGLE_CORRECT"
 *                 mediaUrl: null
 *                 customTimer: 30
 *                 createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 options:
 *                   - id: "c1d2e3f4-0000-0000-0000-000000000001"
 *                     questionId: "b1c2d3e4-0000-0000-0000-000000000001"
 *                     optionText: "Paris"
 *                     isCorrect: true
 *                     orderIndex: 0
 *                 createdAt: "2026-06-24T09:00:00.000Z"
 *                 updatedAt: "2026-06-24T09:00:00.000Z"
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
 *       404:
 *         description: Question not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Question not found"
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:id",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getQuestionById,
);

/**
 * @swagger
 * /question/{id}:
 *   patch:
 *     summary: Update a question (partial update)
 *     description: >
 *       All body fields are optional — supply only the fields you want to change.
 *       Providing `options` replaces the full option set for the question.
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the question to update
 *         example: "b1c2d3e4-0000-0000-0000-000000000001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionUpdate'
 *           example:
 *             questionText: "What is the capital of Germany?"
 *             customTimer: 20
 *             options:
 *               - optionText: "Berlin"
 *                 isCorrect: true
 *                 orderIndex: 0
 *               - optionText: "Munich"
 *                 isCorrect: false
 *                 orderIndex: 1
 *     responses:
 *       200:
 *         description: Question updated — returns the updated question with all options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuestionResponse'
 *       400:
 *         description: Validation error (e.g. customTimer ≤ 0)
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
  "/:id",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.updateQuestion,
);

/**
 * @swagger
 * /question/{id}:
 *   delete:
 *     summary: Delete a question from the question bank
 *     description: >
 *       Permanently deletes the question and all its options.
 *       The question is also removed from any quiz it belongs to (cascade).
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the question to delete
 *         example: "b1c2d3e4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Question deleted successfully
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
 *                   example: "Question deleted"
 *       400:
 *         description: Delete failed (e.g. question not found or constraint error)
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
  "/:id",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.deleteQuestion,
);

module.exports = router;
