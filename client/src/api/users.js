import { api } from './client';

// { name?, currency?, monthStartDay?, timezone?, onboardingDone? } → the updated user
export async function updateProfile(changes) {
  const res = await api.patch('/users/me', changes);
  return res.data.data.user;
}

// { aiEnabled?, digestEmail?, budgetAlerts?, theme? } → the updated user
export async function updateSettings(changes) {
  const res = await api.patch('/users/me/settings', changes);
  return res.data.data.user;
}

// Downloads all account data as a JSON file → { blob, filename }
export async function exportData() {
  const res = await api.get('/users/me/export', { responseType: 'blob' });
  const disposition = res.headers['content-disposition'] ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'paisa-pal-export.json';
  return { blob: res.data, filename };
}

export async function deleteAccount(password) {
  await api.delete('/users/me', { data: { password } });
}
