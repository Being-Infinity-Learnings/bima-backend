/**
 * notification.service.js
 *
 * Handles all notification business logic:
 *  - FCM token registration / removal
 *  - Sending & dispatching notifications (immediate + scheduled)
 *  - Fetching the per-user notification feed with correct targeting,
 *    cursor-based pagination, and optional type / date filters
 */

const prisma = require("../../config/prisma");
const admin = require("../../config/firebase");

// ─────────────────────────────────────────────────────────────────────────────
// Constants (kept here so they can be imported by the controller too)
// ─────────────────────────────────────────────────────────────────────────────

/** Default page size for the /my feed. Overridable via query param. */
const DEFAULT_PAGE_SIZE = 20;

/** Hard upper-bound so callers cannot request unlimited rows. */
const MAX_PAGE_SIZE = 100;

// ─────────────────────────────────────────────────────────────────────────────
// FCM Token management
// ─────────────────────────────────────────────────────────────────────────────

// Register or update a user's FCM token record.
async function registerFcmToken(userId, token, platform) {
  await prisma.fcmToken.upsert({
    where: { token },
    update: { userId, platform, updatedAt: new Date() },
    create: { userId, token, platform },
  });
}

// Remove a user's FCM token so it no longer receives notifications.
async function unregisterFcmToken(userId, token) {
  await prisma.fcmToken.deleteMany({ where: { userId, token } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Send / dispatch
// ─────────────────────────────────────────────────────────────────────────────

// Create a notification record and dispatch it now or schedule it for later.
async function sendNotification({
  title,
  body,
  type,
  targetType,
  groupId,
  sendAt,
  createdById,
}) {
  const notification = await prisma.notification.create({
    data: {
      title,
      body,
      type: type || "ANNOUNCEMENT",
      targetType: targetType || "ALL",
      groupId: groupId || null,
      sendAt: sendAt ? new Date(sendAt) : null,
      status: "PENDING",
      createdById,
    },
  });

  if (!sendAt) {
    await dispatchNotification(notification);
  }

  return notification;
}

// Dispatch a stored notification to the correct FCM tokens based on targetType.
async function dispatchNotification(notification) {
  console.log("[FCM] Dispatching notification:", notification.id);
  try {
    let tokens = [];

    if (notification.targetType === "ALL") {
      // Send to every approved, non-blocked user
      const fcmRecords = await prisma.fcmToken.findMany({
        include: { user: { select: { approved: true, blocked: true } } },
      });
      tokens = fcmRecords
        .filter((r) => r.user.approved && !r.user.blocked)
        .map((r) => r.token);
    } else if (notification.targetType === "GROUP" && notification.groupId) {
      // Send only to members of the target group
      const members = await prisma.userGroup.findMany({
        where: { groupId: notification.groupId },
        include: {
          user: { include: { fcmTokens: true } },
        },
      });
      tokens = members
        .filter((m) => m.user.approved && !m.user.blocked)
        .flatMap((m) => m.user.fcmTokens.map((t) => t.token));
    }

    console.log(`[FCM] Dispatching to ${tokens.length} tokens`);

    if (tokens.length === 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      return;
    }

    const chunks = chunkArray(tokens, 500);
    let successCount = 0;
    let failCount = 0;

    for (const chunk of chunks) {
      const message = {
        tokens: chunk,

        // System notification shown when app is in background / killed
        notification: {
          title: notification.title,
          body: notification.body,
        },

        // Readable by the Flutter app in all lifecycle states
        data: {
          notificationId: notification.id,
          type: notification.type,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },

        android: {
          // "HIGH" uppercase is required — lowercase is silently ignored
          priority: "HIGH",
          notification: {
            channelId: "bima_default",
            defaultSound: true,
            defaultVibrateTimings: true,
          },
        },

        apns: {
          headers: { "apns-priority": "10" },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const result = await admin.messaging().sendEachForMulticast(message);
      successCount += result.successCount;
      failCount += result.failureCount;

      // Clean up stale / invalid tokens so they don't pollute the DB
      result.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          console.warn(
            `[FCM] Token failed (${code}): ${chunk[idx].substring(0, 20)}...`,
          );
          if (
            code === "messaging/invalid-registration-token" ||
            code === "messaging/registration-token-not-registered"
          ) {
            await prisma.fcmToken
              .delete({ where: { token: chunk[idx] } })
              .catch(() => {}); // ignore if already deleted
          }
        }
      });
    }

    console.log(`[FCM] Done — success: ${successCount}, failed: ${failCount}`);

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    console.error("[FCM] dispatch error:", err);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled dispatcher (called by a cron / interval in app.js)
// ─────────────────────────────────────────────────────────────────────────────

// Find pending scheduled notifications and dispatch any that are due.
async function dispatchPendingScheduled() {
  const due = await prisma.notification.findMany({
    where: { status: "PENDING", sendAt: { lte: new Date() } },
  });
  for (const n of due) {
    await dispatchNotification(n);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: list all notifications (history view)
// ─────────────────────────────────────────────────────────────────────────────

// Return the notification history for admin and author views.
async function listNotifications() {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { fullName: true, email: true } } },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// User feed: /notifications/my
//
// BUG FIX: the previous implementation returned ALL sent notifications
// regardless of targetType, meaning GROUP-targeted messages were visible to
// everyone.  This version filters correctly:
//
//  • ALL / APPROVED_ONLY → visible to every approved, non-blocked user
//  • GROUP               → visible only to members of the target group
//
// It also supports cursor-based pagination and optional filters so the Flutter
// app can implement "load more" and category tabs efficiently without full
// re-fetches.
//
// Params:
//  @param {string}   userId      - The authenticated user's DB id
//  @param {boolean}  approved    - Whether the user is approved
//  @param {boolean}  blocked     - Whether the user is blocked
//  @param {string[]} groupIds    - Groups the user belongs to
//  @param {object}   filters
//    @param {string}   [filters.type]      - NotificationType enum value
//    @param {string}   [filters.dateFrom]  - ISO date string (inclusive)
//    @param {string}   [filters.dateTo]    - ISO date string (inclusive)
//    @param {string}   [filters.cursor]    - Last seen notification id (for pagination)
//    @param {number}   [filters.limit]     - Page size (capped at MAX_PAGE_SIZE)
//
// Returns: { items: Notification[], nextCursor: string|null }
// ─────────────────────────────────────────────────────────────────────────────

// Return the current user's notification feed, filtered by audience and pagination.
async function getMyNotifications(
  userId,
  approved,
  blocked,
  groupIds,
  filters = {},
) {
  // Blocked users see nothing
  if (blocked) return { items: [], nextCursor: null };

  const limit = Math.min(
    Number(filters.limit) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  // ── Build the targetType filter ──────────────────────────────────────────
  // A notification is visible to this user when:
  //   a) targetType is ALL or APPROVED_ONLY AND the user is approved, OR
  //   b) targetType is GROUP AND the user is a member of that group
  //
  // We use an OR at the top level so Prisma can push it into a single query.

  const targetFilter = {
    OR: [
      // Broadcast notifications (all approved users)
      ...(approved ? [{ targetType: { in: ["ALL", "APPROVED_ONLY"] } }] : []),
      // Group-specific notifications the user belongs to
      ...(groupIds.length > 0
        ? [{ targetType: "GROUP", groupId: { in: groupIds } }]
        : []),
    ],
  };

  // Edge case: user is not approved and has no groups → nothing to show
  if (targetFilter.OR.length === 0) {
    return { items: [], nextCursor: null };
  }

  // ── Optional filters ─────────────────────────────────────────────────────

  const extraFilters = {};

  if (filters.type) {
    extraFilters.type = filters.type;
  }

  if (filters.dateFrom || filters.dateTo) {
    // Filter on sentAt (the time the notification was actually sent)
    extraFilters.sentAt = {};
    if (filters.dateFrom) {
      extraFilters.sentAt.gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      // Include the whole end day by setting time to 23:59:59
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      extraFilters.sentAt.lte = end;
    }
  }

  // ── Cursor pagination ────────────────────────────────────────────────────
  // We use keyset pagination on sentAt DESC + id DESC so we never skip rows
  // even when notifications arrive mid-scroll.

  let cursorClause = {};
  if (filters.cursor) {
    // Fetch the cursor row's sentAt so we can paginate correctly
    const cursorRow = await prisma.notification.findUnique({
      where: { id: filters.cursor },
      select: { sentAt: true },
    });
    if (cursorRow?.sentAt) {
      // Items that were sent before the cursor (older), or same sentAt but
      // with a lexicographically smaller id
      cursorClause = {
        OR: [
          { sentAt: { lt: cursorRow.sentAt } },
          { sentAt: cursorRow.sentAt, id: { lt: filters.cursor } },
        ],
      };
    }
  }

  // ── Query ────────────────────────────────────────────────────────────────
  // Fetch limit+1 rows so we can detect whether a next page exists without
  // a separate COUNT query (which is expensive on large tables).

  const rows = await prisma.notification.findMany({
    where: {
      status: "SENT",
      ...targetFilter, // audience targeting
      ...extraFilters, // optional type / date filters
      ...(Object.keys(cursorClause).length ? cursorClause : {}),
    },
    orderBy: [
      { sentAt: "desc" },
      { id: "desc" }, // tie-breaker for same sentAt
    ],
    take: limit + 1, // +1 to check for next page
    select: {
      id: true,
      title: true,
      body: true,
      type: true,
      sentAt: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return { items, nextCursor };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Split an array into chunks of a given maximum size.
function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size)
    result.push(arr.slice(i, i + size));
  return result;
}

module.exports = {
  registerFcmToken,
  unregisterFcmToken,
  sendNotification,
  dispatchPendingScheduled,
  listNotifications,
  getMyNotifications,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
};
