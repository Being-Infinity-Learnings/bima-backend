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
 * /quiz/my:
 *   get:
 *     summary: Retrieve quizzes available to the current user
 *     description: >
 *       Returns quizzes that the authenticated user can access based on quiz
 *       visibility and their group memberships. Only quizzes in SCHEDULED or
 *       LIVE state are returned.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of quizzes the current user can access
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/QuizzesResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "d1e2f3a4-0000-0000-0000-000000000001"
 *                   title: "General Knowledge Quiz"
 *                   coverImageUrl: null
 *                   scheduledStartTime: "2026-07-01T10:00:00.000Z"
 *                   status: "LIVE"
 *                   visibility: "PUBLIC"
 *                   _count:
 *                     quizQuestions: 10
 *       401:
 *         description: Missing or invalid Bearer token
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
router.get("/my", auth, controller.getMyQuizzes);

/**
 * @swagger
 * /quiz/my/history:
 *   get:
 *     summary: Get paginated quiz history for the current student
 *     description: >
 *       Returns one row per COMPLETED quiz the current student submitted at
 *       least one answer to, ordered by most recently completed first. Only
 *       summary result data is returned (title, completion date, score,
 *       participant count, and question count) — question or answer content is
 *       never included.
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of records to return per page
 *     responses:
 *       200:
 *         description: Paginated history results with metadata
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
 *                         format: uuid
 *                       title:
 *                         type: string
 *                       completedAt:
 *                         type: string
 *                         format: date-time
 *                       scheduledStartTime:
 *                         type: string
 *                         format: date-time
 *                       _count:
 *                         type: object
 *                         properties:
 *                           quizQuestions:
 *                             type: integer
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Missing or invalid Bearer token
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
router.get("/my/history", auth, controller.getMyHistory);

/**
 * @swagger
 * /quiz/my/{quizId}:
 *   get:
 *     summary: Retrieve a quiz available to the current user by ID
 *     description: >
 *       Returns the quiz details for the authenticated user if the quiz is
 *       visible to them and is currently SCHEDULED or LIVE. Includes runtime
 *       information such as the current phase and remaining time when available.
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
 *         description: UUID of the quiz to retrieve
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Quiz details returned successfully
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                       nullable: true
 *                     coverImageUrl:
 *                       type: string
 *                       nullable: true
 *                     visibility:
 *                       type: string
 *                     scheduledStartTime:
 *                       type: string
 *                       format: date-time
 *                     defaultTimer:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     _count:
 *                       type: object
 *                       properties:
 *                         quizQuestions:
 *                           type: integer
 *                     runtime:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         phase:
 *                           type: string
 *                         remainingTime:
 *                           type: integer
 *                           nullable: true
 *                         phaseStartedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         phaseEndsAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Quiz not found or not accessible to the current user
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
router.get("/my/:quizId", auth, controller.getMyQuizById);

/**
 * @swagger
 * /quiz/{id}:
 *   get:
 *     summary: Retrieve a quiz by ID
 *     description: >
 *       Returns the full quiz details for an existing quiz. This endpoint is
 *       intended for ADMIN or AUTHOR users managing quiz content.
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
 *       400:
 *         description: Quiz ID is missing or malformed
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
