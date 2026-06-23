/**
 * notification.controller.js
 *
 * HTTP handlers for the /notifications routes.
 * All user-context data (id, approved, blocked, groups) is read from
 * req.dbUser which is populated by the authenticate middleware — no extra
 * DB round-trips at the controller level.
 */

const svc = require("./notification.service");

// ─────────────────────────────────────────────────────────────────────────────
// FCM token management
// ─────────────────────────────────────────────────────────────────────────────

// Handler: registerToken(req, res)
// - Registers or updates the authenticated user's FCM token.
async function registerToken(req, res) {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) {
      return res
        .status(400)
        .json({ success: false, message: "token and platform required" });
    }
    await svc.registerFcmToken(req.dbUser.id, token, platform);
    return res.json({
      success: true,
      data: { message: "FCM token registered" },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// Handler: unregisterToken(req, res)
// - Removes the authenticated user's FCM token.
async function unregisterToken(req, res) {
  try {
    const { token } = req.body;
    await svc.unregisterFcmToken(req.dbUser.id, token);
    return res.json({ success: true, data: { message: "FCM token removed" } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: send notification
// ─────────────────────────────────────────────────────────────────────────────

// Handler: sendNotification(req, res)
// - Creates a notification and dispatches it immediately or schedules it.
async function sendNotification(req, res) {
  try {
    const { title, body, type, targetType, groupId, sendAt } = req.body;
    if (!title || !body) {
      return res
        .status(400)
        .json({ success: false, message: "title and body required" });
    }
    const notification = await svc.sendNotification({
      title,
      body,
      type,
      targetType,
      groupId,
      sendAt,
      createdById: req.dbUser.id,
    });
    return res.json({ success: true, data: notification });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin / Author: full notification history
// ─────────────────────────────────────────────────────────────────────────────

// Handler: listNotifications(req, res)
// - Returns the full notification history for admins and authors.
async function listNotifications(req, res) {
  try {
    const data = await svc.listNotifications();
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User feed: GET /notifications/my
//
// BUG FIX: previously returned ALL sent notifications to every user.
// Now correctly filters by targetType and the user's group memberships.
//
// Query params (all optional):
//   type      – NotificationType filter  (e.g. ANNOUNCEMENT, QUIZ_REMINDER)
//   dateFrom  – ISO date string, start of range (inclusive)
//   dateTo    – ISO date string, end of range   (inclusive, end of day)
//   cursor    – Pagination cursor (last seen notification id)
//   limit     – Items per page (default: DEFAULT_PAGE_SIZE, max: MAX_PAGE_SIZE)
//
// Response shape:
//   { success: true, data: { items: [...], nextCursor: string|null } }
// ─────────────────────────────────────────────────────────────────────────────

// Handler: getMyNotifications(req, res)
// - Returns the authenticated user's notification feed with filtering and pagination.
async function getMyNotifications(req, res) {
  try {
    const user = req.dbUser;

    // Collect the ids of every group the user belongs to.
    // The authenticate middleware should already include groupMemberships if
    // the user model is fetched with that relation — if not, we default to [].
    const groupIds = (user.groupMemberships ?? []).map((m) => m.groupId);

    const filters = {
      type: req.query.type || null,
      dateFrom: req.query.dateFrom || null,
      dateTo: req.query.dateTo || null,
      cursor: req.query.cursor || null,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await svc.getMyNotifications(
      user.id,
      user.approved,
      user.blocked,
      groupIds,
      filters,
    );

    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

module.exports = {
  registerToken,
  unregisterToken,
  sendNotification,
  listNotifications,
  getMyNotifications,
};
