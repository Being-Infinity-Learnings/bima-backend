// Database helpers for admin operations on users. These
// functions perform queries and updates using Prisma.

const prisma = require("../../config/prisma");

// Return users awaiting approval (not approved, not blocked).
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

// Return all users ordered by creation time.
async function getAllUsers() {
  return await prisma.user.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Approve a user account by id.
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

// Block a user account by id.
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

// Unblock a user account by id.
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
