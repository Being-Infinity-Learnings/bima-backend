const express =
require("express");

const router =
express.Router();

const authenticate =
require("../../middleware/auth.middleware");

const authorize =
require("../../middleware/role.middleware");

const adminController =
require("./admin.controller");

router.get(
    "/pending-users",
    authenticate,
    authorize("ADMIN"),
    adminController.getPendingUsers
);

module.exports = router;