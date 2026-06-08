// Central API service for dashboard backend operations.
//
// All requests use the Firebase authentication token and normalize backend responses.
import { auth } from "../config/firebase.config.js";

const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

// Retrieve the current Firebase auth token for bearer authentication.
async function getToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
}

// Normalize backend JSON payloads to return the underlying data field when present.
function normalizeResponse(payload) {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

// Create a standardized API error object for all failed backend calls.
function createApiError(status, payload) {
  const message =
    payload?.message ||
    payload?.error ||
    (status === 404 ? "Requested resource was not found." : "Request failed.");

  return {
    status,
    message,
    error: payload?.error,
    details: payload,
  };
}

// Perform a request against the backend API with JSON body support and auth headers.
async function request(method, path, body = null) {
  const token = await getToken();
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);
  const raw = await res.text();
  let parsed = null;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw };
    }
  }

  if (!res.ok) {
    throw createApiError(res.status, parsed);
  }

  return normalizeResponse(parsed);
}

export const authApi = {
  getMyProfile: () => request("GET", "/auth/me"),
  registerProfile: (body) => request("POST", "/auth/register-profile", body),
};

export const adminApi = {
  getPendingUsers: () => request("GET", "/admin/pending-users"),
  getAllUsers: () => request("GET", "/admin/users"),
  approveUser: (id) => request("POST", `/admin/users/${id}/approve`),
  blockUser: (id) => request("POST", `/admin/users/${id}/block`),
  unblockUser: (id) => request("POST", `/admin/users/${id}/unblock`),
  updateUserRole: (id, role) =>
    request("PATCH", `/admin/users/${id}/role`, { role }),
  getUserById: (id) => request("GET", `/admin/users/${id}`),
};

export const groupsApi = {
  getAll: () => request("GET", "/groups"),
  getById: (id) => request("GET", `/groups/${id}`),
  create: (body) => request("POST", "/groups/create", body),
  update: (id, body) => request("PATCH", `/groups/${id}`, body),
  delete: (id) => request("DELETE", `/groups/${id}`),
  getMembers: (id) => request("GET", `/groups/${id}/users`),
  addUser: (gId, uId) => request("POST", `/groups/${gId}/users/${uId}`),
  removeUser: (gId, uId) => request("DELETE", `/groups/${gId}/users/${uId}`),
};
