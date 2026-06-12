const express = require("express");
const router = express.Router();
const authenticate = require("../../middleware/auth.middleware");
const authorize = require("../../middleware/role.middleware");
const ctrl = require("./notification.controller");

// Student: register/unregister FCM token
router.post("/fcm-token", authenticate, ctrl.registerToken);
router.delete("/fcm-token", authenticate, ctrl.unregisterToken);

// Admin only: send/schedule notifications
router.post("/send", authenticate, authorize("ADMIN"), ctrl.sendNotification);

// Admin + Author: view history
router.get(
  "/",
  authenticate,
  authorize("ADMIN", "AUTHOR"),
  ctrl.listNotifications,
);

// Any authenticated user: their own notification feed
router.get("/my", authenticate, ctrl.getMyNotifications);

module.exports = router;
