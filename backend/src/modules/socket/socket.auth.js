const admin = require("../../config/firebase");
const prisma = require("../../config/prisma");

async function authenticate(socket, next) {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentication required"));
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

module.exports = authenticate;
