/**
 * auth.middleware.js
 *
 * Verifies incoming requests by validating the Firebase ID token and
 * attaching both the decoded Firebase token and the corresponding database
 * user record (including group memberships) to `req` for downstream handlers.
 *
 * `req.dbUser` shape:
 *   id, firebaseUid, email, phone, fullName, gender, collegeName,
 *   rollNumber, role, approved, blocked, createdAt, updatedAt,
 *   groupMemberships: [{ groupId, userId, createdAt }]
 *
 * The groupMemberships relation is included here (rather than in each
 * controller) so that every protected route can use it for notification
 * targeting, permission checks, etc. without extra round-trips.
 */

const admin = require("../config/firebase");
const prisma = require("../config/prisma");

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

    // Include groupMemberships so controllers can use them for audience
    // checks (e.g. notification targeting) without a second query.
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decoded.uid },
      include: {
        groupMemberships: {
          select: { groupId: true },
        },
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
