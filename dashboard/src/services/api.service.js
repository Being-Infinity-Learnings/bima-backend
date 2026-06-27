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
  getUserGroups: (id) => request("GET", `/admin/users/${id}/groups`),
  bulkApproveUsers: (userIds) =>
    request("POST", "/admin/users/bulk-approve", { userIds }),
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
  bulkAssignUsers: (gId, userIds) =>
    request("POST", `/groups/${gId}/bulk-assign`, { userIds }),
  bulkAssignByFile: (gId, identifiers) =>
    request("POST", `/groups/${gId}/bulk-assign-by-file`, { identifiers }),
};

export const notificationsApi = {
  send: (body) => request("POST", "/notifications/send", body),
  list: () => request("GET", "/notifications"),
  myNotifications: () => request("GET", "/notifications/my"),
};

// ── Quiz Composition API ────────────────────────────────────────────────────
// Quiz status lifecycle: DRAFT → SCHEDULED → LIVE → COMPLETED
// publish()   moves DRAFT      → SCHEDULED  (validates: future time, ≥1 question, groups if restricted)
// unpublish() moves SCHEDULED  → DRAFT
// LIVE and COMPLETED are set by the backend scheduler — not editable from dashboard.
export const quizApi = {
  getAll: () => request("GET", "/quiz"),
  getById: (id) => request("GET", `/quiz/${id}`),
  // Required fields: title, defaultTimer (seconds), scheduledStartTime (ISO string)
  create: (body) => request("POST", "/quiz", body),
  update: (id, body) => request("PATCH", `/quiz/${id}`, body),
  delete: (id) => request("DELETE", `/quiz/${id}`),
  // publish: DRAFT → SCHEDULED (server validates scheduledStartTime is future, ≥1 question, etc.)
  publish: (id) => request("POST", `/quiz/${id}/publish`),
  // unpublish: SCHEDULED → DRAFT
  unpublish: (id) => request("POST", `/quiz/${id}/unpublish`),
  getGroups: (quizId) => request("GET", `/quiz/${quizId}/groups`),
  addGroups: (quizId, groupIds) =>
    request("POST", `/quiz/${quizId}/groups`, { groupIds }),
  removeGroup: (quizId, groupId) =>
    request("DELETE", `/quiz/${quizId}/groups/${groupId}`),
};

// ── Question Bank API ───────────────────────────────────────────────────────
// customTimer is optional (null = use quiz defaultTimer during playback)
export const questionApi = {
  getAll: () => request("GET", "/question"),
  getById: (id) => request("GET", `/question/${id}`),
  // body: { questionText, questionType, options[], customTimer? }
  create: (body) => request("POST", "/question", body),
  update: (id, body) => request("PATCH", `/question/${id}`, body),
  delete: (id) => request("DELETE", `/question/${id}`),
};

// Image uploads no longer go through a separate endpoint. The dashboard
// reads the picked file as a base64 data URL purely for local preview, and
// only sends it to the backend (as `imageBase64` / `coverImageBase64`)
// inside the question/quiz create or update request body — the backend
// uploads to S3 at that point. See ImageUploader in QuizzesPage.jsx.

// ── Quiz Composition API ────────────────────────────────────────────────────
export const quizCompositionApi = {
  getQuestions: (quizId) =>
    request("GET", `/quiz-composition/${quizId}/questions`),
  addQuestions: (quizId, questionIds) =>
    request("POST", `/quiz-composition/${quizId}/questions`, { questionIds }),
  removeQuestion: (quizId, questionId) =>
    request("DELETE", `/quiz-composition/${quizId}/questions/${questionId}`),
  reorderQuestions: (quizId, questionIds) =>
    request("PATCH", `/quiz-composition/${quizId}/questions/order`, {
      questionIds,
    }),
};
