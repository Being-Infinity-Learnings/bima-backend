// this file encapsulate database operations related to user profiles.
// Provides helpers to create profiles and fetch users by Firebase UID.

const prisma = require("../../config/prisma");

// Create a user profile if not existing, otherwise return existing one.
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
    data,
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

module.exports = {
  createUserProfile,
  getUserByFirebaseUid,
};
