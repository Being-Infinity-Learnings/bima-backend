const svc = require("./notification.service");
const prisma = require("../../config/prisma");

async function registerToken(req, res) {
  try {
    const { token, platform } = req.body;
    if (!token || !platform) {
      return res
        .status(400)
        .json({ success: false, message: "token and platform required" });
    }
    // req.dbUser is already attached by authenticate middleware
    await svc.registerFcmToken(req.dbUser.id, token, platform);
    return res.json({
      success: true,
      data: { message: "FCM token registered" },
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

async function unregisterToken(req, res) {
  try {
    const { token } = req.body;
    await svc.unregisterFcmToken(req.dbUser.id, token);
    return res.json({ success: true, data: { message: "FCM token removed" } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

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
      createdById: req.dbUser.id, // use req.dbUser, not a fresh lookup
    });
    return res.json({ success: true, data: notification });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

async function listNotifications(req, res) {
  try {
    const data = await svc.listNotifications();
    return res.json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

async function getMyNotifications(req, res) {
  try {
    const data = await prisma.notification.findMany({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        sentAt: true,
        createdAt: true,
      },
    });
    return res.json({ success: true, data });
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
