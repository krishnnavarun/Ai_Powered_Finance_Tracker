import { Notification } from '../models/Notification.js';
import { findOwnedOrThrow } from './ownership.js';

export async function notify(userId, { kind = 'system', title, body = '', link = null }) {
  return Notification.create({ userId, kind, title, body, link });
}

export async function listNotifications(userId, { limit = 30 } = {}) {
  const [notifications, unread] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(limit),
    Notification.countDocuments({ userId, read: false }),
  ]);
  return { notifications, unread };
}

export async function markRead(userId, id) {
  const notification = await findOwnedOrThrow(Notification, userId, id, { label: 'Notification' });
  notification.read = true;
  await notification.save();
  return notification;
}

export async function markAllRead(userId) {
  const result = await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
  return { updated: result.modifiedCount };
}
