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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await adminService.getUserById(id);

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
  } catch (error) {
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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }
    const user = await adminService.approveUser(id);

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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await adminService.blockUser(id);

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
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await adminService.unblockUser(id);

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
    const { id } = req.params;
    const { role } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const allowedRoles = ["ADMIN", "AUTHOR", "STUDENT"];

    if (!role || !allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles are: ${allowedRoles.join(", ")}`,
      });
    }

    const user = await adminService.updateUserRole(id, role);

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

// Handler: getUserGroups(req, res)
// - Returns all groups the given user is a member of.
async function getUserGroups(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const groups = await adminService.getUserGroups(id);
    return res.status(200).json({
      success: true,
      data: groups,
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
  getUserGroups,
};

// Handler: bulkApproveUsers(req, res)
async function bulkApproveUsers(req, res) {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "userIds must be a non-empty array" });
    }
    const result = await adminService.bulkApproveUsers(userIds);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

Object.assign(module.exports, { bulkApproveUsers });
// Store Admin API controllers

// GET /admin/store/items
async function getAllStoreItems(req, res) {
  try {
    const items = await adminService.getAllStoreItems();

    return res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}

// POST /admin/store/items
async function createStoreItem(req, res) {
  try {
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }
    const {
      name,
      description,
      imageUrl,
      imageBase64,
      coinCost,
      stock,
      status,
    } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "name is required and must be a non-empty string",
      });
    }

    if (!Number.isInteger(coinCost) || coinCost < 0) {
      return res.status(400).json({
        success: false,
        message: "coinCost must be a non-negative integer",
      });
    }

    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({
        success: false,
        message: "stock must be a non-negative integer",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "description must be a string or null",
      });
    }

    if (
      imageUrl !== undefined &&
      imageUrl !== null &&
      typeof imageUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "imageUrl must be a string or null",
      });
    }
    if (imageBase64 !== undefined && imageBase64 !== null) {
      if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
        return res.status(400).json({
          success: false,
          message: "imageBase64 must be a non-empty string",
        });
      }
    }

    if (
      status !== undefined &&
      !["ACTIVE", "INACTIVE"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "status must be ACTIVE or INACTIVE",
      });
    }

    const item = await adminService.createStoreItem(
      { name, description, imageUrl, imageBase64, coinCost, stock, status },
      req.dbUser.id,
    );

    return res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}

// PATCH /admin/store/items/:id
async function updateStoreItem(req, res) {
  try {
    // Validate request body before destructuring
    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body) ||
      Object.keys(req.body).length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Request body is required",
      });
    }

    const {
      name,
      description,
      imageUrl,
      imageBase64,
      coinCost,
      stock,
      status,
    } = req.body;

    // Validate name
    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "name must be a non-empty string",
      });
    }

    // Validate coinCost
    if (
      coinCost !== undefined &&
      (!Number.isInteger(coinCost) || coinCost < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "coinCost must be a non-negative integer",
      });
    }

    // Validate stock
    if (
      stock !== undefined &&
      (!Number.isInteger(stock) || stock < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "stock must be a non-negative integer",
      });
    }

    // Validate description
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "description must be a string or null",
      });
    }

    // Validate imageUrl
    if (
      imageUrl !== undefined &&
      imageUrl !== null &&
      typeof imageUrl !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "imageUrl must be a string or null",
      });
    }
    // Validate imageBase64
    if (imageBase64 !== undefined && imageBase64 !== null) {
      if (typeof imageBase64 !== "string" || !imageBase64.trim()) {
        return res.status(400).json({
          success: false,
          message: "imageBase64 must be a non-empty string",
        });
      }
    }
    // Validate status
    if (
      status !== undefined &&
      !["ACTIVE", "INACTIVE"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "status must be ACTIVE or INACTIVE",
      });
    }
    // Update store item
    const item = await adminService.updateStoreItem(req.params.id, {
      name,
      description,
      imageUrl,
      imageBase64,
      coinCost,
      stock,
      status,
    });

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
}

Object.assign(module.exports, {
  getAllStoreItems,
  createStoreItem,
  updateStoreItem,
});