const express = require("express");

const router = express.Router();

const auth = require("../../middleware/auth.middleware");

const allowRoles = require("../../middleware/role.middleware");

const upload = require("../../middleware/upload.middleware");

const controller = require("./upload.controller");

router.post(
  "/image",

  auth,

  allowRoles("ADMIN", "AUTHOR"),

  upload.single("file"),

  controller.uploadImage,
);

module.exports = router;
