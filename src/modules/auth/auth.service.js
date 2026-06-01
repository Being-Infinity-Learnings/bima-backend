const prisma = require("../../config/prisma");

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
