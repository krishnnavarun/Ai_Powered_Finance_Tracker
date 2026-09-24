import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { apiError, http, HttpResponse, server, session, testUser } from '@/test/msw';
import { api } from './client';

// Counts calls to /auth/refresh and answers with a new token (or a failure).
function mockRefresh({ fail = false } = {}) {
  const calls = { count: 0 };
  server.use(
    http.post('*/api/auth/refresh', () => {
      calls.count += 1;
      return fail
        ? apiError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again')
        : session('new-token');
    }),
  );
  return calls;
}

// A protected endpoint that only accepts "Bearer new-token".
function mockProtectedPing() {
  server.use(
    http.get('*/api/ping', ({ request }) =>
      request.headers.get('authorization') === 'Bearer new-token'
        ? HttpResponse.json({ success: true, data: { pong: true } })
        : apiError(401, 'TOKEN_EXPIRED', 'Your session has expired'),
    ),
  );
}

beforeEach(() => {
  useAuthStore.setState({ status: 'authenticated', user: testUser, accessToken: 'old-token' });
});

describe('api client', () => {
  it('sends the access token with every request', async () => {
    server.use(
      http.get('*/api/ping', ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('authorization') }),
      ),
    );
    const res = await api.get('/ping');
    expect(res.data.auth).toBe('Bearer old-token');
  });

  it('refreshes an expired token and retries the request', async () => {
    const refresh = mockRefresh();
    mockProtectedPing();

    const res = await api.get('/ping');

    expect(res.data.data.pong).toBe(true);
    expect(refresh.count).toBe(1);
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('uses a single refresh for requests that fail at the same time', async () => {
    const refresh = mockRefresh();
    mockProtectedPing();

    const results = await Promise.all([api.get('/ping'), api.get('/ping'), api.get('/ping')]);

    expect(results.every((res) => res.status === 200)).toBe(true);
    expect(refresh.count).toBe(1);
  });

  it('logs the user out when the session cannot be refreshed', async () => {
    mockRefresh({ fail: true });
    mockProtectedPing();

    await expect(api.get('/ping')).rejects.toMatchObject({ code: 'INVALID_REFRESH_TOKEN' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('retries only once if the new token is also rejected', async () => {
    const refresh = mockRefresh();
    server.use(http.get('*/api/ping', () => apiError(401, 'UNAUTHORIZED', 'Nope')));

    await expect(api.get('/ping')).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(refresh.count).toBe(1);
  });

  it('does not try to refresh when login itself fails', async () => {
    const refresh = mockRefresh();
    server.use(
      http.post('*/api/auth/login', () =>
        apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password'),
      ),
    );

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Incorrect email or password',
    });
    expect(refresh.count).toBe(0);
  });

  it('turns a network failure into a friendly error', async () => {
    server.use(http.get('*/api/ping', () => HttpResponse.error()));
    await expect(api.get('/ping')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
