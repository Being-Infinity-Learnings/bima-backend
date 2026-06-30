const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const controller = require("./runtime.controller");

router.post(
  "/:quizId/initialize",
  auth,
  allowRoles("ADMIN"),
  controller.initialize,
);

router.post("/:quizId/start", auth, allowRoles("ADMIN"), controller.start);

//debug
router.post("/:quizId/submit", auth, controller.submitAnswer);

//debug
router.get("/:quizId/state", auth, controller.getRuntimeState);

module.exports = router;
