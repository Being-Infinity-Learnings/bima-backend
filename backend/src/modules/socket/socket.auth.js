// Purpose: Socket middleware to authenticate clients using Firebase
// ID tokens and attach the corresponding DB user to the socket.
const admin = require("../../config/firebase");
const prisma = require("../../config/prisma");

// Load-test only: skip real Firebase verification for a token shaped
// like "loadtest:<firebaseUid>", looking that user up directly instead.
// Triple-gated so this can never activate outside an explicit load test:
// (1) NODE_ENV must not be "production" — a code-enforced backstop that
// doesn't depend on anyone remembering to unset an env var correctly;
// (2) LOADTEST_AUTH_BYPASS=true must ALSO be set in the process env —
// this must never be set in any real deployment's env config; (3) even if
// both of those somehow held in a real deployment, a real client's
// Firebase ID token would never happen to start with "loadtest:", so real
// users are unaffected either way. See loadtest/broadcast/PERFORMANCE.md
// for why this exists (connecting thousands of synthetic sockets without
// minting real Firebase sessions for each one) and how it's used.
const LOADTEST_BYPASS_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.LOADTEST_AUTH_BYPASS === "true";
const LOADTEST_TOKEN_PREFIX = "loadtest:";

// Authenticate incoming socket connections and populate `socket.dbUser`.
async function authenticate(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    if (LOADTEST_BYPASS_ENABLED && token.startsWith(LOADTEST_TOKEN_PREFIX)) {
      return authenticateLoadTestBypass(socket, token, next);
    }

    const decoded = await admin.auth().verifyIdToken(token);

    const user = await prisma.user.findUnique({
      where: {
        firebaseUid: decoded.uid,
      },

      include: {
        groupMemberships: {
          select: {
            groupId: true,
          },
        },
      },
    });

    if (!user) {
      return next(new Error("Profile not found"));
    }

    if (user.blocked) {
      return next(new Error("Account blocked"));
    }

    socket.user = decoded;

    socket.dbUser = user;

    next();
  } catch (error) {
    next(new Error(error.message));
  }
}

// See the LOADTEST_BYPASS_ENABLED comment above — this path is inert
// unless that env var is explicitly set to "true".
async function authenticateLoadTestBypass(socket, token, next) {
  try {
    const firebaseUid = token.slice(LOADTEST_TOKEN_PREFIX.length);

    const user = await prisma.user.findUnique({
      where: {
        firebaseUid,
      },

      include: {
        groupMemberships: {
          select: {
            groupId: true,
          },
        },
      },
    });

    if (!user) {
      return next(new Error("Profile not found"));
    }

    if (user.blocked) {
      return next(new Error("Account blocked"));
    }

    socket.user = { uid: firebaseUid };

    socket.dbUser = user;

    next();
  } catch (error) {
    next(new Error(error.message));
  }
}

module.exports = authenticate;
