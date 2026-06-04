// This file Verifies incoming requests by validating the Firebase ID token
// and attaching both the decoded Firebase token and corresponding
// database user record (if any) to `req` for downstream handlers.

const admin = require("../config/firebase");

const prisma = require("../config/prisma");

// Middleware: authenticate
// - Reads the `Authorization` header for a Bearer token
// - Verifies the Firebase ID token via `admin.auth().verifyIdToken`
// - Looks up the matching user record in the database
// - Attaches `req.user` (decoded Firebase token) and `req.dbUser`
//   (Prisma user record) to the request object
// - Returns appropriate 401/403/404 responses for invalid tokens,
//   blocked accounts, or missing profiles
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = await admin.auth().verifyIdToken(token);

    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: decoded.uid,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    if (user.blocked) {
      return res.status(403).json({
        success: false,
        message: "Account blocked",
      });
    }

    req.user = decoded;
    req.dbUser = user;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = authenticate;
