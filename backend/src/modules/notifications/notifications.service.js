import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { Notification } from "../../models/Notification.js";
import { User } from "../../models/User.js";

const seedNotifications = new Map();

function nowIso() {
  return new Date().toISOString();
}

function normalizeNotification(payload) {
  return {
    id: payload.id || `ntf-${randomUUID()}`,
    recipientRole: payload.recipientRole,
    recipientUserId: payload.recipientUserId || null,
    shopId: payload.shopId || null,
    title: payload.title,
    message: payload.message,
    type: payload.type || "system_notice",
    entityType: payload.entityType || "system",
    entityId: payload.entityId || "",
    read: Boolean(payload.read),
    createdAt: payload.createdAt || nowIso(),
    updatedAt: payload.updatedAt || nowIso(),
  };
}

function isVisibleToUser(notification, user) {
  if (!user) return false;
  if (notification.recipientUserId && notification.recipientUserId === user.sub) return true;
  if (notification.recipientRole === user.role) {
    if (notification.recipientRole === "seller") {
      return !notification.shopId || notification.shopId === user.shopId;
    }
    return true;
  }
  return false;
}

function seedListNotifications(user, { unreadOnly = false, limit = 30 } = {}) {
  let list = [...seedNotifications.values()].filter((n) => isVisibleToUser(n, user));
  if (unreadOnly) list = list.filter((n) => !n.read);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

async function mongoVisibilityFilter(user) {
  if (user.role === "seller") {
    return {
      $or: [
        { recipientUserId: user.sub },
        { recipientRole: "seller", shopId: user.shopId || null },
      ],
    };
  }
  return {
    $or: [
      { recipientUserId: user.sub },
      { recipientRole: user.role },
    ],
  };
}

export async function createNotification(payload) {
  const normalized = normalizeNotification(payload);
  if (env.mongoUri) {
    const doc = await Notification.create(normalized);
    return doc.toObject ? doc.toObject() : doc;
  }
  seedNotifications.set(normalized.id, normalized);
  return normalized;
}

export async function createNotificationsForRole({
  recipientRole,
  recipientUserIds = [],
  shopId = null,
  title,
  message,
  type,
  entityType = "system",
  entityId = "",
}) {
  const explicitIds = [...new Set((recipientUserIds || []).filter(Boolean))];
  const notifications = [];

  if (recipientRole === "driver" && explicitIds.length === 0) {
    return notifications;
  }

  if (explicitIds.length > 0) {
    for (const recipientUserId of explicitIds) {
      notifications.push(await createNotification({
        recipientRole,
        recipientUserId,
        shopId,
        title,
        message,
        type,
        entityType,
        entityId,
      }));
    }
    return notifications;
  }

  if (env.mongoUri && ["admin", "support"].includes(recipientRole)) {
    const users = await User.find({ role: recipientRole }).select("_id").lean();
    for (const user of users) {
      notifications.push(await createNotification({
        recipientRole,
        recipientUserId: String(user._id),
        shopId,
        title,
        message,
        type,
        entityType,
        entityId,
      }));
    }
    return notifications;
  }

  notifications.push(await createNotification({
    recipientRole,
    shopId,
    title,
    message,
    type,
    entityType,
    entityId,
  }));
  return notifications;
}

export async function listNotifications(user, { unreadOnly = false, limit = 30 } = {}) {
  if (!user?.sub || !user?.role) return [];
  if (env.mongoUri) {
    const filter = await mongoVisibilityFilter(user);
    if (unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return seedListNotifications(user, { unreadOnly, limit });
}

export async function getUnreadCount(user) {
  if (!user?.sub || !user?.role) return 0;
  if (env.mongoUri) {
    const filter = await mongoVisibilityFilter(user);
    filter.read = false;
    return Notification.countDocuments(filter);
  }
  return seedListNotifications(user, { unreadOnly: true, limit: 10_000 }).length;
}

export async function markNotificationRead(id, user) {
  if (!user?.sub) {
    const err = new Error("Access denied.");
    err.status = 403;
    throw err;
  }
  if (env.mongoUri) {
    const visible = await listNotifications(user, { unreadOnly: false, limit: 500 });
    const found = visible.find((item) => item.id === id);
    if (!found) {
      const err = new Error("Notification not found.");
      err.status = 404;
      throw err;
    }
    const updated = await Notification.findOneAndUpdate({ id }, { read: true }, { returnDocument: "after" }).lean();
    return updated;
  }
  const current = seedNotifications.get(id);
  if (!current || !isVisibleToUser(current, user)) {
    const err = new Error("Notification not found.");
    err.status = 404;
    throw err;
  }
  current.read = true;
  current.updatedAt = nowIso();
  return current;
}

export async function markAllRead(user) {
  if (!user?.sub || !user?.role) return { ok: true };
  if (env.mongoUri) {
    const visible = await listNotifications(user, { unreadOnly: false, limit: 1000 });
    const ids = visible.map((item) => item.id);
    if (ids.length) await Notification.updateMany({ id: { $in: ids }, read: false }, { read: true });
    return { ok: true };
  }
  for (const notification of seedNotifications.values()) {
    if (isVisibleToUser(notification, user)) {
      notification.read = true;
      notification.updatedAt = nowIso();
    }
  }
  return { ok: true };
}

export function __resetNotificationsForTests() {
  seedNotifications.clear();
}
