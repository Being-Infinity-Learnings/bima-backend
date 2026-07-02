// Purpose: Express routes for runtime management and debugging. Exposes
// endpoints for initializing and controlling quiz runtimes.
const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const controller = require("./runtime.controller");

// Initialize runtime for a scheduled quiz (ADMIN only)
router.post(
  "/:quizId/initialize",
  auth,
  allowRoles("ADMIN"),
  controller.initialize,
);

// Start the runtime (ADMIN only)
router.post("/:quizId/start", auth, allowRoles("ADMIN"), controller.start);

// Debug: submit an answer via HTTP
router.post("/:quizId/submit", auth, controller.submitAnswer);

// Debug: fetch the current runtime state
router.get("/:quizId/state", auth, controller.getRuntimeState);

module.exports = router;
