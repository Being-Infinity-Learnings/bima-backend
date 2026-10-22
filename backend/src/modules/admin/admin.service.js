// Database helpers for admin operations on users. These
// functions perform queries and updates using Prisma.

const prisma = require("../../config/prisma");
const imageService = require("../upload/image.service");

// Helper to format user record with lean groups array
function formatUserWithGroups(user) {
  if (!user) return null;
  const { groupMemberships, ...rest } = user;
  return {
    ...rest,
    groups: groupMemberships ? groupMemberships.map((m) => m.group) : [],
  };
}

const userGroupsInclude = {
  groupMemberships: {
    select: {
      group: {
        select: { id: true, name: true },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
};

// Return users awaiting approval (not approved, not blocked).
async function getPendingUsers() {
  const users = await prisma.user.findMany({
    where: {
      approved: false,
      blocked: false,
    },
    include: userGroupsInclude,
    orderBy: {
      createdAt: "asc",
    },
  });
  return users.map(formatUserWithGroups);
}

// Return all users ordered by creation time with their groups included.
async function getAllUsers() {
  const users = await prisma.user.findMany({
    include: userGroupsInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
  return users.map(formatUserWithGroups);
}

// Return a user by id with groups included.
async function getUserById(userId) {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    include: userGroupsInclude,
  });
  return formatUserWithGroups(user);
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

// Upload store images to S3 when a new image is provided.
async function resolveStoreImageUrl(data) {
  if (data.imageBase64) {
    return imageService.uploadBase64Image(
      data.imageBase64,
      "store-images",
    );
  }

  if (data.imageUrl !== undefined) {
    return data.imageUrl?.trim() || null;
  }

  return undefined;
}
// Create a new store item and clean up the uploaded image if database creation fails.
async function createStoreItem(data, adminId) {
  let imageUrl;

  try {
    imageUrl = await resolveStoreImageUrl(data);

    return await prisma.storeItem.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        imageUrl: imageUrl ?? null,
        coinCost: data.coinCost,
        stock: data.stock,
        createdById: adminId,
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  } catch (error) {
    // Remove the newly uploaded image if database creation fails.
    if (data.imageBase64 && imageUrl) {
      try {
        await imageService.deleteImageByUrl(imageUrl);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up new store image after database creation failure:",
          cleanupError,
        );
      }
    }

    throw error;
  }
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

  const imageUrl = await resolveStoreImageUrl(data);
  const updateData = {};

  if (data.name !== undefined) {
    updateData.name = data.name.trim();
  }

  if (data.description !== undefined) {
    updateData.description = data.description?.trim() || null;
  }

  if (imageUrl !== undefined) {
    updateData.imageUrl = imageUrl;
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

  let updatedItem;

  try {
    updatedItem = await prisma.storeItem.update({
      where: { id },
      data: updateData,
    });
  } catch (error) {
    // The new image was uploaded, but the database update failed.
    if (
      data.imageBase64 &&
      imageUrl &&
      imageUrl !== existingItem.imageUrl
    ) {
      try {
        await imageService.deleteImageByUrl(imageUrl);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up new store image after database update failure:",
          cleanupError,
        );
      }
    }

    throw error;
  }

  // Delete the previous image only after the database update succeeds.
  if (
    (data.imageBase64 || data.imageUrl !== undefined) &&
    existingItem.imageUrl &&
    existingItem.imageUrl !== updatedItem.imageUrl
  ) {
    try {
      await imageService.deleteImageByUrl(existingItem.imageUrl);
    } catch (cleanupError) {
      console.error(
        "Failed to delete previous store image:",
        cleanupError,
      );
    }
  }

  return updatedItem;
}

// Export the new Store Admin functions.
Object.assign(module.exports, {
  getAllStoreItems,
  createStoreItem,
  updateStoreItem,
});