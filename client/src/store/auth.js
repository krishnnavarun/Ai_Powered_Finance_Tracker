import { create } from 'zustand';

// The logged-in user and their access token. Kept in memory only (never in
// localStorage) so injected scripts can't steal it; after a reload the session is
// restored from the httpOnly refresh cookie (see useSessionBootstrap).
//
// status:    'loading'       — still checking for an existing session on app start
//            'authenticated' — user + accessToken are set
//            'anonymous'     — not logged in
// endReason: why the last session ended — 'logout' (user chose to), 'expired'
//            (refresh failed mid-session) or null. The login page uses it.
export const useAuthStore = create((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  endReason: null,

  setSession: ({ user, accessToken }) =>
    set({ user, accessToken, status: 'authenticated', endReason: null }),
  setUser: (user) => set({ user }),
  clearSession: (endReason = null) =>
    set({ user: null, accessToken: null, status: 'anonymous', endReason }),
}));
