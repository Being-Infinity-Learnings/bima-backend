// Admin-only HTTP handlers for managing user approvals
// and account state (approve, block, unblock). These handlers call
// `admin.service` to perform database updates and return JSON responses.

const adminService = require("./admin.service");

// Handler: getPendingUsers(req, res)
// - Returns users who have not yet been approved and are not blocked.
async function getPendingUsers(req, res) {
  try {
    const users = await adminService.getPendingUsers();

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Handler: getAllUsers(req, res)
// - Returns all user profiles ordered by creation date.
async function getAllUsers(req, res) {
  try {
    const users = await adminService.getAllUsers();

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getUserById(req, res) {
  try {
    const user = await adminService.getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    return res.status(200).json({
      success: true,
      data: user,
    });
  }
    catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Handler: approveUser(req, res)
// - Marks the target user as approved.
async function approveUser(req, res) {
  try {
    const user = await adminService.approveUser(req.params.id);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Handler: blockUser(req, res)
// - Marks the target user as blocked to prevent login/access.
async function blockUser(req, res) {
  try {
    const user = await adminService.blockUser(req.params.id);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Handler: unblockUser(req, res)
// - Clears the blocked flag for a target user.
async function unblockUser(req, res) {
  try {
    const user = await adminService.unblockUser(req.params.id);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

// Handler: updateUserRole(req, res)
// - Validates and updates the role of a target user.
async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    const allowedRoles = ["ADMIN", "AUTHOR", "STUDENT"];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${allowedRoles.join(", ")}`,
      });
    }

    const user = await adminService.updateUserRole(req.params.id, role);

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

module.exports = {
  getPendingUsers,
  getAllUsers,
  approveUser,
  blockUser,
  unblockUser,
  updateUserRole,
  getUserById,
};
