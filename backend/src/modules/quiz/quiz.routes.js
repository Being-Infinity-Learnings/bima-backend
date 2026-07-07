const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");
const allowRoles = require("../../middleware/role.middleware");

const controller = require("./quiz.controller");

/**
 * @swagger
 * tags:
 *   name: Quiz
 *   description: >
 *     Quiz lifecycle management — create, update, publish/unpublish, delete quizzes,
 *     and manage which groups have access to a quiz. Requires ADMIN or AUTHOR role
 *     (delete requires ADMIN).
 */

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
 *           example:
 *             title: "General Knowledge Quiz"
 *             description: "A fun quiz on general knowledge topics."
 *             defaultTimer: 30
 *             visibility: "PUBLIC"
 *             scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *     responses:
 *       201:
 *         description: Quiz created successfully — status is DRAFT by default
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                 title: "General Knowledge Quiz"
 *                 description: "A fun quiz on general knowledge topics."
 *                 coverImageUrl: null
 *                 visibility: "PUBLIC"
 *                 defaultTimer: 30
 *                 status: "DRAFT"
 *                 scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                 actualStartTime: null
 *                 completedAt: null
 *                 createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 createdAt: "2026-06-24T08:00:00.000Z"
 *                 updatedAt: "2026-06-24T08:00:00.000Z"
 *       400:
 *         description: Validation error — title, defaultTimer, or scheduledStartTime missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Scheduled start time is required"
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
 *         description: List of all quizzes across all statuses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizzesResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   title: "General Knowledge Quiz"
 *                   description: "A fun quiz on general knowledge topics."
 *                   coverImageUrl: null
 *                   visibility: "PUBLIC"
 *                   defaultTimer: 30
 *                   status: "DRAFT"
 *                   scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                   actualStartTime: null
 *                   completedAt: null
 *                   createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                   createdAt: "2026-06-24T08:00:00.000Z"
 *                   updatedAt: "2026-06-24T08:00:00.000Z"
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
 *           format: uuid
 *         description: UUID of the quiz
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Quiz found — returns full quiz details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                 title: "General Knowledge Quiz"
 *                 description: "A fun quiz on general knowledge topics."
 *                 coverImageUrl: null
 *                 visibility: "PUBLIC"
 *                 defaultTimer: 30
 *                 status: "SCHEDULED"
 *                 scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                 actualStartTime: null
 *                 completedAt: null
 *                 createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                 createdAt: "2026-06-24T08:00:00.000Z"
 *                 updatedAt: "2026-06-25T09:00:00.000Z"
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
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Quiz not found"
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/my", auth, controller.getMyQuizzes);

/**
 * @swagger
 * /quiz/my/history:
 *   get:
 *     summary: Paginated quiz history for the current student
 *     description: >
 *       Returns one row per COMPLETED quiz the current student submitted at
 *       least one answer to, most recently completed first. Only summary
 *       result data is returned (title, date, rank, participants, score,
 *       question count) — question/answer content is never included.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated history results
 *       401:
 *         description: Missing or invalid Bearer token
 */
router.get("/my/history", auth, controller.getMyHistory);

router.get("/my/:quizId", auth, controller.getMyQuizById);

router.get("/:id", auth, allowRoles("ADMIN", "AUTHOR"), controller.getQuizById);

/**
 * @swagger
 * /quiz/{id}:
 *   patch:
 *     summary: Update an existing quiz (partial update)
 *     description: >
 *       All body fields are optional — supply only the fields you want to change.
 *       `defaultTimer` must be > 0 if provided.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to update
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuizUpdate'
 *           example:
 *             title: "Updated Quiz Title"
 *             defaultTimer: 45
 *             visibility: "RESTRICTED"
 *     responses:
 *       200:
 *         description: Quiz updated — returns the updated quiz
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizResponse'
 *       400:
 *         description: Validation error (e.g. defaultTimer ≤ 0)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Default timer must be greater than zero"
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
  controller.updateQuiz,
);

/**
 * @swagger
 * /quiz/{id}:
 *   delete:
 *     summary: Permanently delete a quiz
 *     description: >
 *       Deletes the quiz and all associated question mappings and group
 *       assignments (cascade). Requires ADMIN role.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to delete
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Quiz deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizDeleteResponse'
 *             example:
 *               success: true
 *               message: "Quiz deleted"
 *       400:
 *         description: Quiz ID missing or quiz not found
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
 *         description: Insufficient role (requires ADMIN)
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
router.delete("/:id", auth, allowRoles("ADMIN"), controller.deleteQuiz);

/**
 * @swagger
 * /quiz/{id}/publish:
 *   post:
 *     summary: Publish a quiz (DRAFT → SCHEDULED)
 *     description: >
 *       Validates that the quiz has at least one question before publishing.
 *       Transitions the quiz status from DRAFT to SCHEDULED.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to publish
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Quiz published — status is now SCHEDULED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                 status: "SCHEDULED"
 *                 title: "General Knowledge Quiz"
 *       400:
 *         description: Quiz cannot be published (e.g. no questions, already published, or not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Quiz must have at least one question before publishing"
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
  "/:id/publish",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.publishQuiz,
);

/**
 * @swagger
 * /quiz/{id}/unpublish:
 *   post:
 *     summary: Unpublish a quiz (SCHEDULED → DRAFT)
 *     description: >
 *       Reverts a SCHEDULED quiz back to DRAFT so it can be edited further.
 *       Cannot unpublish a LIVE or COMPLETED quiz.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to unpublish
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Quiz unpublished — status is now DRAFT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizResponse'
 *             example:
 *               success: true
 *               data:
 *                 id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                 status: "DRAFT"
 *                 title: "General Knowledge Quiz"
 *       400:
 *         description: Quiz cannot be unpublished (e.g. not in SCHEDULED state, or not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Only SCHEDULED quizzes can be unpublished"
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
  "/:id/unpublish",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.unpublishQuiz,
);

/**
 * @swagger
 * /quiz/{quizId}/groups:
 *   post:
 *     summary: Grant quiz access to one or more groups
 *     description: >
 *       Associates the quiz with the supplied groups so that members of those
 *       groups can participate. Relevant only when quiz `visibility` is RESTRICTED.
 *     tags: [Quiz]
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
 *             $ref: '#/components/schemas/AddGroupsToQuizRequest'
 *           example:
 *             groupIds:
 *               - "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *               - "9a3cc027-8c2c-5g2b-a626-416gc7b15b9g"
 *     responses:
 *       201:
 *         description: Groups added — returns the list of new QuizAllowedGroup records
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizGroupsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - quizId: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   groupId: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *       400:
 *         description: Invalid quizId, groupIds missing, or group already assigned
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
  "/:quizId/groups",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.addGroupsToQuiz,
);

/**
 * @swagger
 * /quiz/{quizId}/groups:
 *   get:
 *     summary: Get all groups associated with a quiz
 *     tags: [Quiz]
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
 *         description: List of groups that have access to this quiz
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizGroupsResponse'
 *             example:
 *               success: true
 *               data:
 *                 - quizId: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   groupId: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *                   group:
 *                     id: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *                     name: "Batch A"
 *                     description: "Primary student batch for orientation"
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
  "/:quizId/groups",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.getQuizGroups,
);

/**
 * @swagger
 * /quiz/{quizId}/groups/{groupId}:
 *   delete:
 *     summary: Remove a group's access from a quiz
 *     tags: [Quiz]
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
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the group to remove
 *         example: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *     responses:
 *       200:
 *         description: Group removed from quiz successfully
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
 *                   example: "Group removed"
 *       400:
 *         description: IDs missing or group not assigned to this quiz
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
  "/:quizId/groups/:groupId",
  auth,
  allowRoles("ADMIN", "AUTHOR"),
  controller.removeGroupFromQuiz,
);

module.exports = router;
