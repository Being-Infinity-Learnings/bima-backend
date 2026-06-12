// HTTP handlers for group management endpoints.
// Each handler validates input (when necessary), calls the
// `group.service` for database operations, and returns standardized
// JSON responses.

const { createGroupSchema, updateGroupSchema } = require("./group.validation");

const groupService = require("./group.service");

// Handler: createGroup(req, res)
// - Validates request body and creates a new group using the service
async function createGroup(req, res) {
  try {
    const validated = createGroupSchema.parse(req.body);

    const group = await groupService.createGroup({
      name: validated.name,
      description: validated.description,
      createdById: req.dbUser.id,
    });

    return res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function getAllGroups(req, res) {
  // Handler: getAllGroups(req, res)
  // - Returns a list of groups with member counts
  try {
    const groups = await groupService.getAllGroups();

    return res.status(200).json({
      success: true,
      data: groups,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async function getGroupById(req, res) {
  // Handler: getGroupById(req, res)
  // - Fetches a single group's details including members
  try {
    const { groupId } = req.params;

    const group = await groupService.getGroupById(groupId);

    return res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      error: error.message,
    });
  }
}

async function addUserToGroup(req, res) {
  // Handler: addUserToGroup(req, res)
  // - Adds the given user to the specified group
  try {
    const { groupId, userId } = req.params;

    const membership = await groupService.addUserToGroup(groupId, userId);

    return res.status(201).json({
      success: true,
      data: membership,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function removeUserFromGroup(req, res) {
  // Handler: removeUserFromGroup(req, res)
  // - Removes the given user from the specified group
  try {
    const { groupId, userId } = req.params;

    const result = await groupService.removeUserFromGroup(groupId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function getGroupMembers(req, res) {
  // Handler: getGroupMembers(req, res)
  // - Returns the user list that belongs to the specified group
  try {
    const { groupId } = req.params;

    const users = await groupService.getGroupMembers(groupId);

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function deleteGroup(req, res) {
  // Handler: deleteGroup(req, res)
  // - Deletes the specified group from the database
  try {
    const { groupId } = req.params;

    const result = await groupService.deleteGroup(groupId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}

async function updateGroup(req, res) {
  // Handler: updateGroup(req, res)
  // - Validates update payload and applies changes to the group
  try {
    const { groupId } = req.params;

    const validated = updateGroupSchema.parse(req.body);

    const group = await groupService.updateGroup(groupId, validated);

    return res.status(200).json({
      success: true,
      data: group,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
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
};

// Handler: bulkAssignUsersByIds(req, res)
// - Assigns multiple users (by ID array in body) to a group in one shot.
async function bulkAssignUsersByIds(req, res) {
  try {
    const { groupId } = req.params;
    const { userIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "userIds must be a non-empty array",
      });
    }

    const result = await groupService.bulkAssignUsersByIds(groupId, userIds);

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

// Handler: bulkAssignUsersByFile(req, res)
// - Parses a plain-text body of email/phone identifiers (one per line or comma-separated)
//   and adds matched users to the group.
async function bulkAssignUsersByFile(req, res) {
  try {
    const { groupId } = req.params;
    const { identifiers } = req.body;

    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "identifiers must be a non-empty array of emails or phone numbers",
      });
    }

    const cleaned = identifiers
      .map((s) => String(s).trim().toLowerCase())
      .filter(Boolean);

    const result = await groupService.bulkAssignUsersByIdentifiers(
      groupId,
      cleaned,
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
}

// Re-export everything including new handlers
Object.assign(module.exports, { bulkAssignUsersByIds, bulkAssignUsersByFile });
