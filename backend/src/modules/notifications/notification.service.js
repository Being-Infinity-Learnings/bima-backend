const prisma = require("../../config/prisma");
const admin = require("../../config/firebase");

// ── FCM Token management ──────────────────────────────────────────────────────

async function registerFcmToken(userId, token, platform) {
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

async function dispatchNotification(notification) {
  console.log("INSIDE DISPATCH");
  try {
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
          user: { include: { fcmTokens: true } },
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

        // The `notification` block tells FCM to show a system notification
        // automatically when the app is in background or killed.
        // This is handled by Android OS — no flutter_local_notifications needed.
        notification: {
          title: notification.title,
          body: notification.body,
        },

        // data is readable by your Flutter app in all states
        data: {
          notificationId: notification.id,
          type: notification.type,
          click_action: "FLUTTER_NOTIFICATION_CLICK",
        },

        android: {
          // CRITICAL: "HIGH" uppercase is required by the Admin SDK enum.
          // Lowercase "high" is silently ignored and the message is sent
          // at normal priority, which Android may batch or delay.
          priority: "HIGH",
          notification: {
            // Must match the channel created in Flutter
            channelId: "bima_default",
            // Do NOT set `priority` here — it's not a valid field on
            // AndroidNotification in the Admin SDK and is silently dropped.
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

      // Clean up invalid tokens so they don't clog the DB
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

    console.log(
      `[FCM] Dispatch done — success: ${successCount}, failed: ${failCount}`,
    );

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

// ── Scheduled dispatcher ──────────────────────────────────────────────────────

async function dispatchPendingScheduled() {
  const due = await prisma.notification.findMany({
    where: { status: "PENDING", sendAt: { lte: new Date() } },
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
