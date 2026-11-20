/**
 * store.controller.js
 *
 * HTTP handlers for the user-facing /store routes. Validates query params
 * and path params before delegating to the service layer, and translates
 * Prisma errors into proper HTTP responses.
 */

const storeService = require("./store.service");

// UUID v4 format check — rejects obviously invalid ids before they hit Prisma.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Handler: getStoreItems(req, res)
// - Lists ACTIVE store items with optional sorting and cursor-based pagination.
async function getStoreItems(req, res) {
  try {
    const { sortBy, sortOrder, cursor, limit } = req.query;

    if (sortBy && !storeService.ALLOWED_SORT_FIELDS[sortBy]) {
      return res.status(400).json({
        success: false,
        message: `Invalid sortBy value. Allowed: ${Object.keys(storeService.ALLOWED_SORT_FIELDS).join(", ")}`,
      });
    }

    if (sortOrder && !storeService.ALLOWED_SORT_ORDERS.includes(sortOrder)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sortOrder value. Allowed: asc, desc",
      });
    }

    if (limit !== undefined) {
      const parsed = Number(limit);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return res.status(400).json({
          success: false,
          message: `limit must be a positive integer (max ${storeService.MAX_PAGE_SIZE})`,
        });
      }
    }

    if (cursor && !UUID_RE.test(cursor)) {
      return res.status(400).json({
        success: false,
        message: "Invalid cursor format",
      });
    }

    const result = await storeService.getStoreItems({
      sortBy,
      sortOrder,
      cursor,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    // Prisma P2025: cursor row not found (deleted between pages).
    if (error.code === "P2025") {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired cursor",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve store items",
    });
  }
}

// Handler: getStoreItemById(req, res)
// - Returns a single ACTIVE store item by UUID.
async function getStoreItemById(req, res) {
  try {
    const { id } = req.params;

    if (!id || !UUID_RE.test(id)) {
      return res.status(400).json({
        success: false,
        message: "A valid store item ID is required",
      });
    }

    const item = await storeService.getStoreItemById(id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Store item not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve store item",
    });
  }
}

module.exports = {
  getStoreItems,
  getStoreItemById,
};
