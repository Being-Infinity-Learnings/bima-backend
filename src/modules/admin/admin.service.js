const prisma = require("../../config/prisma");

async function getPendingUsers() {
  return await prisma.user.findMany({
    where: {
      approved: false,
      blocked: false,
    },

    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getAllUsers() {
  return await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

async function approveUser(userId) {
  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      approved: true,
    },
  });
}

async function blockUser(userId) {
  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      blocked: true,
    },
  });
}

async function unblockUser(userId) {
  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      blocked: false,
    },
  });
}

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  blockUser,
  unblockUser,
};
