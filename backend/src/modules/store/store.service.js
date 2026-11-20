/**
 * store.service.js
 *
 * Business logic for the user-facing store: browsing active catalog items
 * with cursor-based pagination and flexible sorting. Only ACTIVE items are
 * surfaced; out-of-stock items remain visible so users can see what exists.
 */

const prisma = require("../../config/prisma");

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// Maps client-facing sort keys to Prisma column names.
const ALLOWED_SORT_FIELDS = {
  price: "coinCost",
  name: "name",
  newest: "createdAt",
};

const ALLOWED_SORT_ORDERS = ["asc", "desc"];

// Fields exposed to authenticated users (never leak createdById or status).
const USER_VISIBLE_SELECT = {
  id: true,
  name: true,
  description: true,
  imageUrl: true,
  coinCost: true,
  stock: true,
  createdAt: true,
};

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

// Return a paginated, sorted list of ACTIVE store items.
async function getStoreItems({ sortBy, sortOrder, cursor, limit }) {
  const pageSize = Math.min(
    Math.max(Number(limit) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );

  const prismaField = ALLOWED_SORT_FIELDS[sortBy] || "createdAt";
  const order = ALLOWED_SORT_ORDERS.includes(sortOrder) ? sortOrder : "desc";

  const queryOptions = {
    where: { status: "ACTIVE" },
    // Secondary sort on id guarantees a stable cursor across rows with
    // identical values in the primary sort column.
    orderBy: [{ [prismaField]: order }, { id: "asc" }],
    take: pageSize + 1,
    select: USER_VISIBLE_SELECT,
  };

  if (cursor) {
    queryOptions.skip = 1;
    queryOptions.cursor = { id: cursor };
  }

  const items = await prisma.storeItem.findMany(queryOptions);

  const hasMore = items.length > pageSize;
  const data = hasMore ? items.slice(0, pageSize) : items;
  const nextCursor = hasMore ? data[data.length - 1].id : null;

  return { items: data, nextCursor };
}

// Return a single ACTIVE store item by id, or null if not found / inactive.
async function getStoreItemById(id) {
  return prisma.storeItem.findFirst({
    where: { id, status: "ACTIVE" },
    select: USER_VISIBLE_SELECT,
  });
}

module.exports = {
  getStoreItems,
  getStoreItemById,
  ALLOWED_SORT_FIELDS,
  ALLOWED_SORT_ORDERS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
