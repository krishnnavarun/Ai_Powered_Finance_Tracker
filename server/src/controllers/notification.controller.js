import * as notificationService from '../services/notification.service.js';

const ok = (res, data) => res.json({ success: true, data });

export const list = async (req, res) =>
  ok(res, await notificationService.listNotifications(req.user.id));

export const markRead = async (req, res) =>
  ok(res, { notification: await notificationService.markRead(req.user.id, req.params.id) });

export const markAllRead = async (req, res) =>
  ok(res, await notificationService.markAllRead(req.user.id));
