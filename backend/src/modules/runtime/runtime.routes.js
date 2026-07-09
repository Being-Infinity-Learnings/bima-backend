// Purpose: Express routes for runtime management and debugging. Exposes
// endpoints for initializing and controlling quiz runtimes.
const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const controller = require("./runtime.controller");

/**
 * @swagger
 * tags:
 *   name: Runtime
 *   description: >
 *     Quiz runtime engine orchestration — initialize, start, debug, and query state of
 *     active quiz runtimes. Endpoints require appropriate roles (initialization and
 *     starting requires ADMIN role). These apis are only for debugging and administrative purposes,
 *     and are not intended to be available to be used in production.
 */

/**
 * @swagger
 * /runtime/{quizId}/initialize:
 *   post:
 *     summary: Initialize the runtime engine for a scheduled quiz
 *     description: >
 *       Loads the quiz data, initializes in-memory state, and boots up the RuntimeEngine.
 *       Transition state to WAITING. Requires ADMIN role.
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz to initialize
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Runtime successfully initialized
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
 *                     quizId:
 *                       type: string
 *                       format: uuid
 *                       example: "d1e2f3a4-0000-0000-0000-000000000001"
 *                     questionCount:
 *                       type: integer
 *                       example: 10
 *                     phase:
 *                       type: string
 *                       example: "WAITING"
 *       400:
 *         description: Validation or loading error (e.g. malformed ID or quiz has no questions)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Quiz must have at least one question before loading"
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
 *       404:
 *         description: Quiz not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Runtime already initialized or quiz status is not SCHEDULED
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Runtime already initialized"
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/:quizId/initialize",
  auth,
  allowRoles("ADMIN"),
  controller.initialize,
);

/**
 * @swagger
 * /runtime/{quizId}/start:
 *   post:
 *     summary: Start an initialized runtime engine
 *     description: Marks the quiz as LIVE and starts the runtime engine game loop. Requires ADMIN role.
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the initialized quiz runtime to start
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Runtime engine started successfully
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
 *                   example: "Runtime started"
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
 *       404:
 *         description: Runtime not initialized (quiz must be initialized first)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Runtime not initialized"
 *       500:
 *         description: Unexpected server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/:quizId/start", auth, allowRoles("ADMIN"), controller.start);

/**
 * @swagger
 * /runtime/{quizId}/submit:
 *   post:
 *     summary: Submit an answer via HTTP (Debug)
 *     description: Submits an answer to the current active question for debugging purposes.
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz runtime
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *               - selectedOptionIds
 *             properties:
 *               questionId:
 *                 type: string
 *                 format: uuid
 *                 description: UUID of the question being answered
 *                 example: "e2f3a4b5-0000-0000-0000-000000000001"
 *               selectedOptionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: List of option UUIDs selected by the user
 *                 example: ["f3a4b5c6-0000-0000-0000-000000000001"]
 *     responses:
 *       200:
 *         description: Answer submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: State or validation error (e.g. not accepting answers, invalid question, or answer already submitted)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Quiz is not accepting answers."
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Runtime not initialized
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
router.post("/:quizId/submit", auth, controller.submitAnswer);

/**
 * @swagger
 * /runtime/{quizId}/state:
 *   get:
 *     summary: Fetch the current runtime state (Debug)
 *     description: Retrieves detailed state of the running engine for inspection and debugging.
 *     tags: [Runtime]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID of the quiz runtime
 *         example: "d1e2f3a4-0000-0000-0000-000000000001"
 *     responses:
 *       200:
 *         description: Detailed runtime state returned successfully
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
 *                     quizId:
 *                       type: string
 *                       format: uuid
 *                       example: "d1e2f3a4-0000-0000-0000-000000000001"
 *                     phase:
 *                       type: string
 *                       example: "QUESTION"
 *                     remainingTime:
 *                       type: integer
 *                       nullable: true
 *                       example: 15000
 *                     phaseStartedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2026-07-01T10:00:00.000Z"
 *                     phaseEndsAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2026-07-01T10:00:15.000Z"
 *                     serverTime:
 *                       type: integer
 *                       example: 1782806400000
 *                     questionIndex:
 *                       type: integer
 *                       example: 0
 *                     question:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           example: "e2f3a4b5-0000-0000-0000-000000000001"
 *                         questionText:
 *                           type: string
 *                           example: "What is the capital of France?"
 *                         questionImage:
 *                           type: string
 *                           nullable: true
 *                           example: "https://example.com/paris.jpg"
 *                         mediaUrl:
 *                           type: string
 *                           nullable: true
 *                           example: "https://example.com/paris.jpg"
 *                         questionType:
 *                           type: string
 *                           example: "SINGLE_CORRECT"
 *                         durationMs:
 *                           type: integer
 *                           example: 15000
 *                         options:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                                 format: uuid
 *                                 example: "f3a4b5c6-0000-0000-0000-000000000001"
 *                               optionText:
 *                                 type: string
 *                                 example: "Paris"
 *                               optionImage:
 *                                 type: string
 *                                 nullable: true
 *                                 example: null
 *       401:
 *         description: Missing or invalid Bearer token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Runtime not initialized
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
router.get("/:quizId/state", auth, controller.getRuntimeState);

module.exports = router;
