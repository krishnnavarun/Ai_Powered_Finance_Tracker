import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { server } from './msw';
import { mockMatchMedia } from './utils';

// Pages are lazy-loaded in the app. Load them all up front in tests, so a test never
// waits for a page to compile (that made tests randomly slow on a busy machine).
import.meta.glob('../pages/*.jsx', { eager: true });

// A little more than the default 1s for findBy* queries, for slow CI machines.
configure({ asyncUtilTimeout: 3000 });

// jsdom lacks a few browser APIs that Radix UI and our theme code use.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// Any request without a matching fake handler fails the test, so nothing slips through.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  useUiStore.setState({ theme: 'system' });
  useAuthStore.setState({ status: 'loading', user: null, accessToken: null });
  document.documentElement.className = '';
});
