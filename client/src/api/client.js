import axios from 'axios';
import { toApiError } from '@/lib/apiError';
import { API_URL } from '@/lib/config';
import { useAuthStore } from '@/store/auth';

// Shared axios instance for every API call. It
//  1. adds "Authorization: Bearer <access token>" to each request,
//  2. when the token has expired (401), refreshes it once and retries the request,
//  3. turns every failure into an ApiError with a code and a readable message.
export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send the refresh cookie to /auth/*
  timeout: 20_000,
});

// These calls must never trigger a token refresh (it would loop or make no sense).
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshInFlight = null;

// Gets a new access token using the refresh cookie. Parallel callers share one
// request, because the server rotates the cookie and a second call would look like theft.
export function refreshSession() {
  refreshInFlight ??= axios
    .post(`${API_URL}/auth/refresh`, null, { withCredentials: true, timeout: 20_000 })
    .then((res) => {
      useAuthStore.getState().setSession(res.data.data);
      return res.data.data;
    })
    .catch((error) => {
      const { status, clearSession } = useAuthStore.getState();
      // Losing a live session is "expired"; failing to restore one on start-up is not.
      clearSession(status === 'authenticated' ? 'expired' : null);
      throw toApiError(error);
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const canRefresh =
      error.response?.status === 401 &&
      request &&
      !request._retried &&
      !NO_REFRESH_URLS.includes(request.url);

    if (canRefresh) {
      request._retried = true;
      await refreshSession(); // throws (and logs the user out) if the session is gone
      return api(request);
    }
    throw toApiError(error);
  },
);
