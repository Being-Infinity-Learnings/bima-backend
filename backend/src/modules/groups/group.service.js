// Database operations for group management. Exposes functions
// to create, update, delete groups and manage memberships via Prisma.

const prisma = require("../../config/prisma");

// Create a new group if the name is not taken.
async function createGroup({ name, description, createdById }) {
  const existingGroup = await prisma.group.findUnique({
    where: {
      name,
    },
  });

  if (existingGroup) {
    throw new Error("Group already exists");
  }

  return prisma.group.create({
    data: {
      name,
      description,
      createdById,
    },
  });
}

async function getAllGroups() {
  // Return a list of groups with a members count, newest first.
  return prisma.group.findMany({
    include: {
      _count: {
        select: {
          members: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}

async function getGroupById(groupId) {
  // Fetch a group by id and include member details.
  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },

    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              role: true,
              approved: true,
              blocked: true,
            },
          },
        },
      },

      _count: {
        select: {
          members: true,
        },
      },
    },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  return group;
}

async function addUserToGroup(groupId, userId) {
  // Add a user to a group after validating both exist and
  // membership does not already exist.
  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const existingMembership = await prisma.userGroup.findUnique({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  if (existingMembership) {
    throw new Error("User already belongs to this group");
  }

  return prisma.userGroup.create({
    data: {
      userId,
      groupId,
    },

    include: {
      user: true,
      group: true,
    },
  });
}

async function removeUserFromGroup(groupId, userId) {
  // Remove a user from the specified group, ensuring membership exists.
  const membership = await prisma.userGroup.findUnique({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  if (!membership) {
    throw new Error("User is not a member of this group");
  }

  await prisma.userGroup.delete({
    where: {
      userId_groupId: {
        userId,
        groupId,
      },
    },
  });

  return {
    message: "User removed from group",
  };
}

async function getGroupMembers(groupId) {
  // Return the user records for a group's members.
  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  const memberships = await prisma.userGroup.findMany({
    where: {
      groupId,
    },

    include: {
      user: true,
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  return memberships.map((membership) => membership.user);
}

async function deleteGroup(groupId) {
  // Delete a group if it exists.
  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  await prisma.group.delete({
    where: {
      id: groupId,
    },
  });

  return {
    message: "Group deleted successfully",
  };
}

async function updateGroup(groupId, updateData) {
  // Update group properties; check for name conflicts when renaming.
  const group = await prisma.group.findUnique({
    where: {
      id: groupId,
    },
  });

  if (!group) {
    throw new Error("Group not found");
  }

  if (updateData.name && updateData.name !== group.name) {
    const existingGroup = await prisma.group.findUnique({
      where: {
        name: updateData.name,
      },
    });

    if (existingGroup) {
      throw new Error("Group name already exists");
    }
  }

  return prisma.group.update({
    where: {
      id: groupId,
    },

    data: {
      ...updateData,
    },
  });
}

// Bulk-assign an array of user IDs to a group.
// Skips duplicates gracefully; returns counts of added and skipped.
async function bulkAssignUsersByIds(groupId, userIds) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");

  // Find which of the given IDs are valid users
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });
  const validIds = new Set(users.map((u) => u.id));

  // Find already-existing memberships to skip
  const existing = await prisma.userGroup.findMany({
    where: { groupId, userId: { in: [...validIds] } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));

  const toAdd = [...validIds].filter((id) => !existingIds.has(id));

  if (toAdd.length > 0) {
    await prisma.userGroup.createMany({
      data: toAdd.map((userId) => ({ userId, groupId })),
      skipDuplicates: true,
    });
  }

  return {
    added: toAdd.length,
    skipped: existingIds.size,
    notFound: userIds.length - validIds.size,
  };
}

// Bulk-add users to a group by matching email addresses or phone numbers
// parsed from an uploaded file's text content.
// Returns per-identifier results so the client can show a summary.
async function bulkAssignUsersByIdentifiers(groupId, identifiers) {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new Error("Group not found");

  const emails = identifiers.filter((s) => s.includes("@"));
  const phones = identifiers.filter((s) => !s.includes("@"));

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.length ? [{ email: { in: emails } }] : []),
        ...(phones.length ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });

  const foundIds = users.map((u) => u.id);

  const existing = await prisma.userGroup.findMany({
    where: { groupId, userId: { in: foundIds } },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((m) => m.userId));

  const toAdd = foundIds.filter((id) => !existingIds.has(id));

  if (toAdd.length > 0) {
    await prisma.userGroup.createMany({
      data: toAdd.map((userId) => ({ userId, groupId })),
      skipDuplicates: true,
    });
  }

  return {
    added: toAdd.length,
    skipped: existingIds.size,
    notFound: identifiers.length - users.length,
  };
}

module.exports = {
  createGroup,
  getAllGroups,
  getGroupById,
  addUserToGroup,
  removeUserFromGroup,
  getGroupMembers,
  deleteGroup,
  updateGroup,
  bulkAssignUsersByIds,
  bulkAssignUsersByIdentifiers,
};
