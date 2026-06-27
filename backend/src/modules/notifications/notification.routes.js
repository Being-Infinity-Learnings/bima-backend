const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const ctrl = require("./notification.controller");

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: >
 *     FCM push notification management. Students register/unregister their device
 *     tokens. Admins send or schedule notifications to all users, specific groups,
 *     or approved users only.
 */

/**
 * @swagger
 * /notifications/fcm-token:
 *   post:
 *     summary: Register an FCM device token for the authenticated user
 *     description: >
 *       Stores the FCM token so the server can push notifications to this device.
 *       If the token already exists for this user it is updated in place.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterFcmTokenRequest'
 *           example:
 *             token: "fMe...long_fcm_token_string"
 *             platform: "android"
 *     responses:
 *       200:
 *         description: FCM token registered (or updated) successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FcmTokenResponse'
 *             example:
 *               success: true
 *               data:
 *                 message: "FCM token registered successfully"
 *       400:
 *         description: Token missing, empty, or platform invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "token is required"
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
router.post("/fcm-token", authenticate, ctrl.registerToken);

/**
 * @swagger
 * /notifications/fcm-token:
 *   delete:
 *     summary: Unregister the FCM device token for the authenticated user
 *     description: >
 *       Removes all stored FCM tokens for the authenticated user, effectively
 *       opting the device out of push notifications (e.g. on logout).
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: FCM token(s) unregistered successfully
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
 *                     message:
 *                       type: string
 *                       example: "FCM token unregistered successfully"
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
router.delete("/fcm-token", authenticate, ctrl.unregisterToken);

/**
 * @swagger
 * /notifications/send:
 *   post:
 *     summary: Send or schedule a push notification (ADMIN only)
 *     description: >
 *       Creates a notification record and dispatches it immediately or at `sendAt`.
 *       Set `targetType` to `ALL` to broadcast, `APPROVED_ONLY` for approved students,
 *       or `GROUP` (and supply `groupId`) to target a specific group.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendNotificationRequest'
 *           example:
 *             title: "Quiz starts in 10 minutes!"
 *             body: "Don't forget to join the upcoming General Knowledge Quiz."
 *             type: "QUIZ_REMINDER"
 *             targetType: "GROUP"
 *             groupId: "802ff6e6-7b1b-4f1a-9515-305fb6a04a8f"
 *             sendAt: null
 *     responses:
 *       200:
 *         description: Notification created and dispatched (or queued)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         description: Validation error — title, body, or targetType missing; groupId required for GROUP target
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "groupId is required when targetType is GROUP"
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
router.post("/send", authenticate, authorize("ADMIN"), ctrl.sendNotification);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List all sent notifications with cursor-based pagination (ADMIN / AUTHOR)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of notifications to return per page
 *         example: 20
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           format: uuid
 *         description: >
 *           UUID of the last notification from the previous page.
 *           Omit to fetch the first page.
 *         example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Paginated list of notifications ordered by createdAt descending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   title: "Quiz starts in 10 minutes!"
 *                   body: "Don't forget to join the upcoming quiz."
 *                   type: "QUIZ_REMINDER"
 *                   targetType: "ALL"
 *                   groupId: null
 *                   sendAt: null
 *                   sentAt: "2026-06-25T10:00:00.000Z"
 *                   status: "SENT"
 *                   createdById: "3d0dbd70-4104-4a0f-995a-4e9e4e2e3d8b"
 *                   createdAt: "2026-06-25T09:55:00.000Z"
 *                   updatedAt: "2026-06-25T10:00:00.000Z"
 *               nextCursor: null
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
  "/",
  authenticate,
  authorize("ADMIN", "AUTHOR"),
  ctrl.listNotifications,
);

/**
 * @swagger
 * /notifications/my:
 *   get:
 *     summary: Get notifications sent to the authenticated user
 *     description: >
 *       Returns notifications that were targeted at the user (via ALL, APPROVED_ONLY,
 *       or a group the user belongs to), ordered by createdAt descending.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications for the authenticated user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *             example:
 *               success: true
 *               data:
 *                 - id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                   title: "Quiz starts in 10 minutes!"
 *                   body: "Don't forget to join the upcoming quiz."
 *                   type: "QUIZ_REMINDER"
 *                   targetType: "ALL"
 *                   groupId: null
 *                   sentAt: "2026-06-25T10:00:00.000Z"
 *                   status: "SENT"
 *               nextCursor: null
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
router.get("/my", authenticate, ctrl.getMyNotifications);

module.exports = router;
