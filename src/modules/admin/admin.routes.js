const express = require("express");

const router = express.Router();

const authenticate = require("../../middleware/auth.middleware");

const authorize = require("../../middleware/role.middleware");

const adminController = require("./admin.controller");

router.get(
  "/pending-users",
  authenticate,
  authorize("ADMIN"),
  adminController.getPendingUsers,
);

router.get(
  "/users",
  authenticate,
  authorize("ADMIN"),
  adminController.getAllUsers,
);

router.post(
  "/users/:id/approve",
  authenticate,
  authorize("ADMIN"),
  adminController.approveUser,
);

router.post(
  "/users/:id/block",
  authenticate,
  authorize("ADMIN"),
  adminController.blockUser,
);

router.post(
  "/users/:id/unblock",
  authenticate,
  authorize("ADMIN"),
  adminController.unblockUser,
);

module.exports = router;
