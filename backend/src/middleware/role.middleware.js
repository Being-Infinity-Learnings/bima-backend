// This is a middleware to authorize a request based on the
// `role` field of the authenticated database user. Use as
// `authorize('ADMIN')` or `authorize('ADMIN', 'AUTHOR')`.

const prisma = require("../config/prisma");

// Middleware : authorize(...allowedRoles)
// - Ensures the authenticated user (from `auth.middleware`) exists
// - Checks the user's `role` against allowed roles and returns 403
//   when the user is not permitted
function authorize(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const firebaseUid = req.user.uid;

      const user = req.dbUser;

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
