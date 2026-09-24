import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// A fake API for tests. Requests are intercepted at the network level, so the real
// axios client, interceptors and pages run exactly as in the browser.

export const testUser = {
  id: '665f1c2e8b3a4d0012345678',
  name: 'Asha Rao',
  email: 'asha@example.com',
  currency: 'INR',
  monthStartDay: 1,
  timezone: 'Asia/Kolkata',
  settings: { aiEnabled: true, digestEmail: true, budgetAlerts: true, theme: 'system' },
  onboardingDone: false,
};

export function apiError(status, code, message, details) {
  return HttpResponse.json(
    { success: false, error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

export function session(accessToken = 'access-token-1', user = testUser) {
  return HttpResponse.json({ success: true, data: { user, accessToken } });
}

// Default: nobody is logged in (no refresh cookie).
export const server = setupServer(
  http.post('*/api/auth/refresh', () =>
    apiError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again'),
  ),
);

export { http, HttpResponse };
