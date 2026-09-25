import { createDemoAccount } from '../seed/demoUser.js';
import * as authService from '../services/auth.service.js';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '../utils/cookies.js';

function requestMeta(req) {
  return { userAgent: req.get('user-agent') };
}

// The refresh token goes in the httpOnly cookie; only the access token goes in the body.
function sendSession(res, status, { user, accessToken, refreshToken }) {
  setRefreshCookie(res, refreshToken);
  res.status(status).json({ success: true, data: { user, accessToken } });
}

export async function register(req, res) {
  sendSession(res, 201, await authService.register(req.body, requestMeta(req)));
}

// A fresh demo account full of sample data, already logged in.
export async function demo(req, res) {
  sendSession(res, 201, await createDemoAccount(requestMeta(req)));
}

export async function login(req, res) {
  sendSession(res, 200, await authService.login(req.body, requestMeta(req)));
}

export async function refresh(req, res) {
  try {
    sendSession(res, 200, await authService.refresh(readRefreshCookie(req), requestMeta(req)));
  } catch (err) {
    // A dead refresh token should not stay in the browser.
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await authService.getCurrentUser(req.user.id);
  res.json({ success: true, data: { user } });
}
