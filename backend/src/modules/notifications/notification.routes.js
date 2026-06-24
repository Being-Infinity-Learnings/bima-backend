const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const ctrl = require("./notification.controller");

// Student: register/unregister FCM token
/**
 * @swagger
 * /notifications/fcm-token:
 *   post:
 *     summary: Register FCM token for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *                 description: FCM device token
 *     responses:
 *       200:
 *         description: Token registered successfully
 *       400:
 *         description: Invalid token supplied
 *       401:
 *         description: Unauthorized
 */
router.post("/fcm-token", authenticate, ctrl.registerToken);
/**
 * @swagger
 * /notifications/fcm-token:
 *   delete:
 *     summary: Unregister FCM token for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token unregistered successfully
 *       401:
 *         description: Unauthorized
 */
router.delete("/fcm-token", authenticate, ctrl.unregisterToken);

// Admin only: send/schedule notifications
/**
 * @swagger
 * /notifications/send:
 *   post:
 *     summary: Send a notification (admin only)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendNotificationRequest'
 *     responses:
 *       200:
 *         description: Notification sent
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post("/send", authenticate, authorize("ADMIN"), ctrl.sendNotification);

// Admin + Author: view history
/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: List notifications (admin/author)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Pagination cursor
 *     responses:
 *       200:
 *         description: List of notifications
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "AUTHOR"),
  ctrl.listNotifications,
);

// Any authenticated user: their own notification feed
/**
 * @swagger
 * /notifications/my:
 *   get:
 *     summary: Get notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user's notifications
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NotificationListResponse'
 *       401:
 *         description: Unauthorized
 */
router.get("/my", authenticate, ctrl.getMyNotifications);

module.exports = router;
