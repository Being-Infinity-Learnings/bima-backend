const prisma = require("../config/prisma");

function authorize(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const firebaseUid = req.user.uid;

      const user = await prisma.user.findUnique({
        where: {
          firebaseUid,
        },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden",
        });
      }

      req.dbUser = user;

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };
}

module.exports = authorize;
