const express =
require("express");

const router =
express.Router();

const authenticate =
require("../../middleware/auth.middleware");

const authController =
require("./auth.controller");

router.post(
    "/register-profile",
    authenticate,
    authController.registerProfile
);

router.get(
  "/test",
  authenticate,
  (req, res) => {

    res.status(200).json({
      success: true,
      firebaseUser: req.user
    });

  }
);

module.exports = router;