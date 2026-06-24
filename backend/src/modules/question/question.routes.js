const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");
const allowRoles = require("../../middleware/role.middleware");

const controller = require("./question.controller");

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
 *     responses:
 *       201:
 *         description: Question created
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
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
 *     summary: Retrieve all questions
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of questions
 *       500:
 *         description: Server error
 */
router.get("/", auth, allowRoles("ADMIN", "AUTHOR"), controller.getQuestions);

/**
 * @swagger
 * /question/{id}:
 *   get:
 *     summary: Retrieve a question by ID
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question data
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
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
 *     summary: Update a question
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuestionUpdate'
 *     responses:
 *       200:
 *         description: Question updated
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
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
 *     summary: Delete a question
 *     tags: [Question]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Question ID
 *     responses:
 *       200:
 *         description: Question deleted
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.deleteQuestion,
);

module.exports = router;
