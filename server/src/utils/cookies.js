import { env } from '../config/env.js';
import { refreshTokenMaxAgeMs } from '../services/token.service.js';

export const REFRESH_COOKIE = 'pp_rt';

// httpOnly: JavaScript can't read it (safe from XSS).
// path: only sent to /api/auth, never with normal API calls.
// In production the client (Vercel) and API (Render) are different sites, so the
// cookie must be SameSite=None + Secure to be sent at all.
function baseOptions() {
  const production = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: production,
    sameSite: production ? 'none' : 'lax',
    path: '/api/auth',
  };
}

export function setRefreshCookie(res, refreshToken) {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), maxAge: refreshTokenMaxAgeMs() });
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, baseOptions());
}

export function readRefreshCookie(req) {
  return req.cookies?.[REFRESH_COOKIE];
}
