import * as accountService from '../services/account.service.js';
import * as userService from '../services/user.service.js';
import { clearRefreshCookie } from '../utils/cookies.js';
import { localDateOf } from '../utils/dates.js';

export async function updateProfile(req, res) {
  const user = await userService.updateProfile(req.user.id, req.body);
  res.json({ success: true, data: { user } });
}

export async function updateSettings(req, res) {
  const user = await userService.updateSettings(req.user.id, req.body);
  res.json({ success: true, data: { user } });
}

// A download of everything in the account.
export async function exportData(req, res) {
  const data = await accountService.exportData(req.user.id);
  const day = localDateOf(new Date(), data.user.timezone ?? 'Asia/Kolkata');
  res
    .set({
      'Content-Disposition': `attachment; filename="paisa-pal-export-${day}.json"`,
      'Cache-Control': 'private, no-store',
    })
    .json(data);
}

export async function deleteAccount(req, res) {
  await accountService.deleteAccount(req.user.id, req.body.password);
  clearRefreshCookie(res);
  res.status(204).end();
}
