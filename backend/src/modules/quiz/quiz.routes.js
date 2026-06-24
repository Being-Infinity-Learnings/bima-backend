const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");
const allowRoles = require("../../middleware/role.middleware");

const controller = require("./quiz.controller");

/**
 * @swagger
 * /quiz:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuizCreate'
 *     responses:
 *       201:
 *         description: Quiz created successfully
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post("/", auth, allowRoles("ADMIN", "AUTHOR"), controller.createQuiz);

/**
 * @swagger
 * /quiz:
 *   get:
 *     summary: Retrieve all quizzes
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quizzes
 *       500:
 *         description: Server error
 */
router.get("/", auth, allowRoles("ADMIN", "AUTHOR"), controller.getQuizzes);

/**
 * @swagger
 * /quiz/{id}:
 *   get:
 *     summary: Retrieve a quiz by ID
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: Quiz data
 *       404:
 *         description: Quiz not found
 *       500:
 *         description: Server error
 */
router.get("/:id", auth, allowRoles("ADMIN", "AUTHOR"), controller.getQuizById);

/**
 * @swagger
 * /quiz/{id}:
 *   patch:
 *     summary: Update an existing quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuizUpdate'
 *     responses:
 *       200:
 *         description: Quiz updated
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.patch(
  "/:id",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.updateQuiz,
);

/**
 * @swagger
 * /quiz/{id}:
 *   delete:
 *     summary: Delete a quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: Quiz deleted
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.delete("/:id", auth, allowRoles("ADMIN"), controller.deleteQuiz);

/**
 * @swagger
 * /quiz/{id}/publish:
 *   post:
 *     summary: Publish a quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: Quiz published
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/publish",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.publishQuiz,
);

/**
 * @swagger
 * /quiz/{id}/unpublish:
 *   post:
 *     summary: Unpublish a quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quiz ID
 *     responses:
 *       200:
 *         description: Quiz unpublished
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post(
  "/:id/unpublish",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.unpublishQuiz,
);

/**
 * @swagger
 * /quiz/{quizId}/groups:
 *   post:
 *     summary: Add groups to a quiz
 *     tags: [Quiz]
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
 *               groupIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Groups added
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.post(
  "/:quizId/groups",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.addGroupsToQuiz,
);

/**
 * @swagger
 * /quiz/{quizId}/groups:
 *   get:
 *     summary: Get groups associated with a quiz
 *     tags: [Quiz]
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
 *         description: List of groups
 *       500:
 *         description: Server error
 */
router.get(
  "/:quizId/groups",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getQuizGroups,
);

/**
 * @swagger
 * /quiz/{quizId}/groups/{groupId}:
 *   delete:
 *     summary: Remove a group from a quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group removed
 *       400:
 *         description: Bad request
 *       500:
 *         description: Server error
 */
router.delete(
  "/:quizId/groups/:groupId",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.removeGroupFromQuiz,
);

module.exports = router;
