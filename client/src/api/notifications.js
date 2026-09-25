import { api } from './client';

// → { notifications, unread }
export async function listNotifications() {
  const res = await api.get('/notifications');
  return res.data.data;
}

export async function markNotificationRead(id) {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  await api.post('/notifications/read-all');
}
