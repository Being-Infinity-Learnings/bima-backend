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

// Return a user by id.
async function getUserById(userId) {
  return await prisma.user.findUnique({
    where: {
      id: userId,
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

// Update a user's role by id.
async function updateUserRole(userId, role) {
  return await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      role,
    },
  });
}

// Return all groups a user belongs to (id + name only — lean query).
async function getUserGroups(userId) {
  const memberships = await prisma.userGroup.findMany({
    where: { userId },
    select: {
      group: {
        select: { id: true, name: true },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
  return memberships.map((m) => m.group);
}

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  blockUser,
  unblockUser,
  updateUserRole,
  getUserById,
  getUserGroups,
};

// Bulk-approve an array of user IDs. Returns count of updated records.
async function bulkApproveUsers(userIds) {
  const result = await prisma.user.updateMany({
    where: {
      id: { in: userIds },
      approved: false,
      blocked: false,
    },
    data: { approved: true },
  });
  return { approved: result.count };
}

Object.assign(module.exports, { bulkApproveUsers });
// Store Admin APIs

// Return all store items, including inactive and out-of-stock items.
async function getAllStoreItems() {
  return await prisma.storeItem.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

// Create a new store item.
async function createStoreItem(data, adminId) {
  return await prisma.storeItem.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      coinCost: data.coinCost,
      stock: data.stock,
      createdById: adminId,
      ...(data.status !== undefined && { status: data.status }),
    },
  });
}

// Update an existing store item.
async function updateStoreItem(id, data) {
  const existingItem = await prisma.storeItem.findUnique({
    where: { id },
  });

  if (!existingItem) {
    const error = new Error("Store item not found");
    error.statusCode = 404;
    throw error;
  }

  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }

  if (data.imageUrl !== undefined) {
    updateData.imageUrl = data.imageUrl?.trim() || null;
  }

  if (data.coinCost !== undefined) {
    updateData.coinCost = data.coinCost;
  }

  if (data.stock !== undefined) {
    updateData.stock = data.stock;
  }

  if (data.status !== undefined) {
    updateData.status = data.status;
  }

  return await prisma.storeItem.update({
    where: { id },
    data: updateData,
  });
}

// Export the new Store Admin functions.
Object.assign(module.exports, {
  getAllStoreItems,
  createStoreItem,
  updateStoreItem,
});