// this file encapsulate database operations related to user profiles.
// Provides helpers to create profiles and fetch users by Firebase UID.

const prisma = require("../../config/prisma");
const appConfig = require("../../config/app.config");

// Same shape as `req.dbUser` (see auth.middleware.js), so a user returned
// from this service can stand in for it in responses.
const userProfileInclude = {
  groupMemberships: {
    select: { groupId: true },
  },
};

// Create a user profile if not existing, otherwise return existing one.
// New users are approved immediately unless NEED_ADMIN_APPROVAL is on.
async function createUserProfile(data) {
  const existingUser = await prisma.user.findUnique({
    where: {
      firebaseUid: data.firebaseUid,
    },
  });

  if (existingUser) {
    return existingUser;
  }

  return await prisma.user.create({
    data: {
      ...data,
      approved: !appConfig.needAdminApproval,
    },
  });
}

// When NEED_ADMIN_APPROVAL is off, approve a pending, non-blocked user and
// return their refreshed profile. Otherwise return the user unchanged.
// The update is conditional (approved = false AND blocked = false), so it
// never overrides an admin who blocks or approves the user at the same time.
async function autoApprovePendingUser(user) {
  if (appConfig.needAdminApproval || user.approved || user.blocked) {
    return user;
  }

  await prisma.user.updateMany({
    where: {
      id: user.id,
      approved: false,
      blocked: false,
    },
    data: {
      approved: true,
    },
  });

  return await prisma.user.findUnique({
    where: {
      id: user.id,
    },
    include: userProfileInclude,
  });
}

// Return a Prisma `user` record matching the provided Firebase UID.
async function getUserByFirebaseUid(firebaseUid) {
  return await prisma.user.findUnique({
    where: {
      firebaseUid,
    },
  });
}

async function updateUserProfile(firebaseUid, data) {
  return await prisma.user.update({
    where: {
      firebaseUid,
    },
    data,
  });
}

module.exports = {
  createUserProfile,
  autoApprovePendingUser,
  getUserByFirebaseUid,
  updateUserProfile,
};
