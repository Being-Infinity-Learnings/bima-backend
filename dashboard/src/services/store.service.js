// Store API service for admin reward management.
//
// Directly interfaces with backend admin store endpoints:
// - GET   /admin/store/items       (Get all store items)
// - POST  /admin/store/items       (Create a store item)
// - PATCH /admin/store/items/:id   (Update a store item)

import { request } from "./api.service.js";

// Helper to format payload and handle base64 vs remote image URLs
function buildStorePayload(data, isPatch = false) {
  const payload = {};

  if (data.name !== undefined) {
    payload.name = data.name.trim();
  }

  if (data.description !== undefined) {
    payload.description = data.description ? data.description.trim() : null;
  }

  if (data.coinCost !== undefined) {
    payload.coinCost = Math.max(0, Math.round(Number(data.coinCost)));
  }

  if (data.stock !== undefined || data.startingStock !== undefined) {
    const rawStock = data.stock !== undefined ? data.stock : data.startingStock;
    payload.stock = Math.max(0, Math.round(Number(rawStock)));
  }

  if (data.status !== undefined) {
    payload.status = data.status;
  }

  // Handle image upload: if base64 data URL, send imageBase64; otherwise imageUrl
  if (data.imageUrl !== undefined) {
    if (typeof data.imageUrl === "string" && data.imageUrl.startsWith("data:image/")) {
      payload.imageBase64 = data.imageUrl;
    } else {
      payload.imageUrl = data.imageUrl ? data.imageUrl.trim() : null;
    }
  }

  // Defaults for POST requests if missing
  if (!isPatch) {
    if (payload.coinCost === undefined) payload.coinCost = 0;
    if (payload.stock === undefined) payload.stock = 0;
    if (!payload.status) payload.status = "ACTIVE";
  }

  return payload;
}

export const storeApi = {
  // GET /admin/store/items
  getItems: () => request("GET", "/admin/store/items"),

  // POST /admin/store/items
  createItem: (data) => request("POST", "/admin/store/items", buildStorePayload(data, false)),

  // PATCH /admin/store/items/:id
  updateItem: (id, data) => request("PATCH", `/admin/store/items/${id}`, buildStorePayload(data, true)),
};
