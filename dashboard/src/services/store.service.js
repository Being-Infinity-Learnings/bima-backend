// Store service for managing redeemable rewards.
//
// Handles store items listing, creation, and updates.
// Automatically connects to the backend API when available (/store/items),
// and gracefully provides persistent dummy data fallback when the API PR is in review.

import { auth } from "../config/firebase.config.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const STORAGE_KEY = "bima_store_items_dummy_v1";

const INITIAL_DUMMY_ITEMS = [
  {
    id: "item-1",
    name: "Wireless Earbuds",
    description: "Bluetooth 5.3, 30h battery",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #4ade80 0%, #2dd4bf 100%)",
    coinCost: 250,
    stock: 12,
    status: "ACTIVE",
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
  },
  {
    id: "item-2",
    name: "College Hoodie",
    description: "Unisex, sizes S–XL",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #818cf8 0%, #60a5fa 100%)",
    coinCost: 180,
    stock: 6,
    status: "ACTIVE",
    createdAt: "2026-10-02T10:00:00Z",
    updatedAt: "2026-10-02T10:00:00Z",
  },
  {
    id: "item-3",
    name: "Desk Lamp",
    description: "USB-C, 3 brightness levels",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)",
    coinCost: 320,
    stock: 3,
    status: "ACTIVE",
    createdAt: "2026-10-03T10:00:00Z",
    updatedAt: "2026-10-03T10:00:00Z",
  },
  {
    id: "item-4",
    name: "Water Bottle",
    description: "Steel, 750ml",
    imageUrl: null,
    gradient: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
    coinCost: 60,
    stock: 0,
    status: "ACTIVE",
    createdAt: "2026-10-04T10:00:00Z",
    updatedAt: "2026-10-04T10:00:00Z",
  },
];

// Helper to get fallback items from localStorage
function getLocalItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DUMMY_ITEMS));
      return INITIAL_DUMMY_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : INITIAL_DUMMY_ITEMS;
  } catch {
    return INITIAL_DUMMY_ITEMS;
  }
}

// Helper to save fallback items to localStorage
function saveLocalItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

async function getToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

function normalizeResponse(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

// Store API client
export const storeApi = {
  // GET /store/items — List every item, including disabled or out-of-stock.
  getItems: async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/store/items`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Endpoint doesn't exist yet (404/500) -> use dummy fallback
        return getLocalItems();
      }

      const raw = await res.json();
      const data = normalizeResponse(raw);
      if (Array.isArray(data)) {
        return data;
      }
      return getLocalItems();
    } catch {
      // Backend not running or endpoint not yet deployed -> dummy fallback
      return getLocalItems();
    }
  },

  // POST /store/items — Create a new item (name, description, image, coin cost, starting stock).
  createItem: async (body) => {
    const payload = {
      name: body.name,
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      coinCost: Number(body.coinCost) || 0,
      stock: Number(body.stock ?? body.startingStock) || 0,
      status: body.status || "ACTIVE",
    };

    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/store/items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const raw = await res.json();
        return normalizeResponse(raw);
      }
    } catch {
      // Fall through to local simulation
    }

    // Local fallback creation
    const current = getLocalItems();
    const newItem = {
      id: `item-${Date.now()}`,
      ...payload,
      gradient: body.imageUrl
        ? null
        : "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...current];
    saveLocalItems(updated);
    return newItem;
  },

  // PATCH /store/items/:id — Update an item — including swapping image, adjusting stock, or disabling it.
  updateItem: async (id, body) => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/store/items/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const raw = await res.json();
        return normalizeResponse(raw);
      }
    } catch {
      // Fall through to local simulation
    }

    // Local fallback update
    const current = getLocalItems();
    const idx = current.findIndex((item) => item.id === id);
    if (idx !== -1) {
      const updatedItem = {
        ...current[idx],
        ...body,
        coinCost:
          body.coinCost !== undefined
            ? Number(body.coinCost)
            : current[idx].coinCost,
        stock:
          body.stock !== undefined ? Number(body.stock) : current[idx].stock,
        updatedAt: new Date().toISOString(),
      };
      current[idx] = updatedItem;
      saveLocalItems([...current]);
      return updatedItem;
    }
    throw new Error("Item not found");
  },

  // Reset dummy data back to defaults (convenient for testing)
  resetToDefaults: () => {
    saveLocalItems(INITIAL_DUMMY_ITEMS);
    return [...INITIAL_DUMMY_ITEMS];
  },
};
