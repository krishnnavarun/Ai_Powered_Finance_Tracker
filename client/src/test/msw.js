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
  onboardingDone: true,
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

const empty = (data) => HttpResponse.json({ success: true, data });

// Defaults: nobody is logged in (no refresh cookie); logout always succeeds; the user
// has no wallets or transactions yet. Tests override these with server.use() or
// installFakeApi().
// A brand-new user's forecast and health score (nothing recorded yet).
export const emptyForecast = {
  month: '2026-09',
  fromDate: '2026-09-01',
  toDate: '2026-09-30',
  today: '2026-09-24',
  balance: 0,
  predictedEnd: 0,
  averageDaily: 0,
  daysLeft: 6,
  upcomingExpense: 0,
  upcomingIncome: 0,
  warning: null,
  series: [{ date: '2026-09-24', actual: 0, predicted: 0 }],
  budgets: [],
  upcoming: [],
};
export const emptyHealth = {
  score: 33,
  grade: 'Needs care',
  monthsUsed: 0,
  parts: [
    {
      key: 'savings',
      label: 'Saving money',
      score: 0,
      max: 35,
      value: null,
      tip: 'Add your income so we can see how much you save.',
    },
    {
      key: 'budgets',
      label: 'Sticking to budgets',
      score: 15,
      max: 25,
      value: null,
      tip: 'Set a budget or two.',
    },
    {
      key: 'stability',
      label: 'Steady spending',
      score: 10,
      max: 15,
      value: null,
      tip: 'More months will tell.',
    },
    {
      key: 'goals',
      label: 'Goals on track',
      score: 8,
      max: 15,
      value: null,
      tip: 'Add a savings goal.',
    },
    {
      key: 'buffer',
      label: 'Emergency money',
      score: 0,
      max: 10,
      value: null,
      tip: 'Keep 3 months aside.',
    },
  ],
};

export const server = setupServer(
  http.post('*/api/auth/refresh', () =>
    apiError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again'),
  ),
  http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),
  http.get('*/api/wallets', () => empty({ wallets: [] })),
  http.get('*/api/categories', () => empty({ categories: [] })),
  http.get('*/api/transactions', () =>
    empty({
      transactions: [],
      totals: { income: 0, expense: 0, transfer: 0 },
      pagination: { page: 1, limit: 25, total: 0, totalPages: 1 },
    }),
  ),
  http.get('*/api/budgets/status', () =>
    empty({
      month: '2026-09',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      daysLeft: 7,
      totalSpent: 0,
      budgets: [],
    }),
  ),
  http.get('*/api/budgets', () => empty({ month: '2026-09', budgets: [] })),
  http.get('*/api/goals', () => empty({ goals: [] })),
  http.get('*/api/ai/forecast', () => empty(emptyForecast)),
  http.get('*/api/ai/health-score', () => empty(emptyHealth)),
  http.get('*/api/ai/subscriptions', () =>
    empty({ subscriptions: [], totals: { yearly: 0, monthly: 0, count: 0 } }),
  ),
  http.get('*/api/insights', () => empty({ insights: [], unseen: 0 })),
  http.get('*/api/chat/sessions', () => empty({ sessions: [] })),
  http.get('*/api/notifications', () => empty({ notifications: [], unread: 0 })),
  http.get('*/api/ai/status', () => empty({ enabled: true, configured: true, provider: 'gemini' })),
  http.get('*/api/reports/by-category', () =>
    empty({ from: '2026-09-01', to: '2026-09-30', type: 'expense', total: 0, categories: [] }),
  ),
  http.get('*/api/reports/trend', () =>
    empty({
      months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'].map((month) => ({
        month,
        income: 0,
        expense: 0,
        saved: 0,
      })),
    }),
  ),
);

export { http, HttpResponse };
