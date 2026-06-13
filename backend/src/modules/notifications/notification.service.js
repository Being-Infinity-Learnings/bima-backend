const prisma = require("../../config/prisma");
const admin = require("../../config/firebase");

// ── FCM Token management ──────────────────────────────────────────────────────

async function registerFcmToken(userId, token, platform) {
  // upsert: if token exists for another user, reassign it (device changed hands)
  await prisma.fcmToken.upsert({
    where: { token },
    update: { userId, platform, updatedAt: new Date() },
    create: { userId, token, platform },
  });
}

async function unregisterFcmToken(userId, token) {
  await prisma.fcmToken.deleteMany({ where: { userId, token } });
}

// ── Send notification ─────────────────────────────────────────────────────────

async function sendNotification({
  title,
  body,
  type,
  targetType,
  groupId,
  sendAt,
  createdById,
}) {
  // 1. Save to DB
  const notification = await prisma.notification.create({
    data: {
      title,
      body,
      type: type || "ANNOUNCEMENT",
      targetType: targetType || "ALL",
      groupId: groupId || null,
      sendAt: sendAt ? new Date(sendAt) : null,
      status: sendAt ? "PENDING" : "PENDING",
      createdById,
    },
  });

  // 2. If immediate (no sendAt), dispatch now
  if (!sendAt) {
    await dispatchNotification(notification);
  }

  return notification;
}

async function dispatchNotification(notification) {
  try {
    // Resolve target FCM tokens
    let tokens = [];

    if (notification.targetType === "ALL") {
      const fcmRecords = await prisma.fcmToken.findMany({
        include: { user: { select: { approved: true, blocked: true } } },
      });
      tokens = fcmRecords
        .filter((r) => r.user.approved && !r.user.blocked)
        .map((r) => r.token);
    } else if (notification.targetType === "GROUP" && notification.groupId) {
      const members = await prisma.userGroup.findMany({
        where: { groupId: notification.groupId },
        include: {
          user: {
            include: {
              fcmTokens: true,
            },
          },
        },
      });
      tokens = members
        .filter((m) => m.user.approved && !m.user.blocked)
        .flatMap((m) => m.user.fcmTokens.map((t) => t.token));
    } else if (notification.targetType === "APPROVED_ONLY") {
      const fcmRecords = await prisma.fcmToken.findMany({
        include: { user: { select: { approved: true, blocked: true } } },
      });
      tokens = fcmRecords
        .filter((r) => r.user.approved && !r.user.blocked)
        .map((r) => r.token);
    }

    if (tokens.length === 0) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "SENT", sentAt: new Date() },
      });
      return;
    }

    // FCM sendEachForMulticast (max 500 tokens per call)
    const chunks = chunkArray(tokens, 500);
    for (const chunk of chunks) {
      const message = {
        tokens: chunk,

        // This 'notification' block is what Android uses to show the
        // system notification when the app is in background or killed.
        // Without this, only foreground (handled by flutter_local_notifications)
        // works. With it, ALL states work.
        notification: {
          title: notification.title,
          body: notification.body,
        },

        // Extra data your Flutter app can read
        data: {
          notificationId: notification.id,
          type: notification.type,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },

        android: {
          priority: "high",
          notification: {
            channelId: "bima_default", // must match the channel you created in Flutter
            priority: "high",
            defaultSound: true,
            defaultVibrateTimings: true,
            notificationCount: 1,
          },
        },

        apns: {
          headers: {
            "apns-priority": "10",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              contentAvailable: true,
            },
          },
        },
      };
      await admin.messaging().sendEachForMulticast(message);
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "SENT", sentAt: new Date() },
    });
  } catch (err) {
    console.error("FCM dispatch error:", err);
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: "FAILED" },
    });
  }
}

// ── Scheduled dispatcher (call this on a cron/interval) ──────────────────────

async function dispatchPendingScheduled() {
  const due = await prisma.notification.findMany({
    where: {
      status: "PENDING",
      sendAt: { lte: new Date() },
    },
  });
  for (const n of due) {
    await dispatchNotification(n);
  }
}

// ── List / history ────────────────────────────────────────────────────────────

async function listNotifications() {
  return prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { fullName: true, email: true } } },
  });
}

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
};
