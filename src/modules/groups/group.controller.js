const { createGroupSchema } = require("./group.validation");

const groupService = require("./group.service");

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
  try {
    const { groupId } = req.params;

    const group = await groupService.getGroupById(
      groupId
    );

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
  try {
    const { groupId, userId } = req.params;

    const membership =
      await groupService.addUserToGroup(
        groupId,
        userId
      );

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

async function removeUserFromGroup(
  req,
  res
) {
  try {
    const { groupId, userId } = req.params;

    const result =
      await groupService.removeUserFromGroup(
        groupId,
        userId
      );

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
  try {
    const { groupId } = req.params;

    const users =
      await groupService.getGroupMembers(
        groupId
      );

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

module.exports = {
  createGroup,
  getAllGroups,
  getGroupById,
  addUserToGroup,
  removeUserFromGroup,
  getGroupMembers,
};
