import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { toast } from 'sonner';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { useUiStore } from '@/store/ui';
import { server } from './msw';
import { mockMatchMedia } from './utils';

// Pages are lazy-loaded, so the first visit to a page in a test file waits for it to
// compile. findBy* queries may wait up to 10s for that on a busy machine; they return as
// soon as the element appears, so passing tests are not slowed down.
// (Preloading every page in every test file instead made the whole suite twice as slow.)
configure({ asyncUtilTimeout: 20_000 });

// jsdom lacks a few browser APIs that Radix UI and our theme code use.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
// Receipt previews use blob: URLs.
URL.createObjectURL ??= () => 'blob:test-preview';
URL.revokeObjectURL ??= () => {};
// "Appear when scrolled into view" animations (landing page): everything counts as visible.
globalThis.IntersectionObserver ??= class {
  constructor(callback) {
    this.callback = callback;
  }
  observe(target) {
    this.callback([{ isIntersecting: true, target, intersectionRatio: 1 }], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// Any request without a matching fake handler fails the test, so nothing slips through.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  // Sonner keeps toasts in a global store that outlives the component; clear it so one
  // test's toasts never show up in the next.
  toast.dismiss();
  cleanup();
  server.resetHandlers();
  localStorage.clear();
  useUiStore.setState({ theme: 'system' });
  useAuthStore.setState({ status: 'loading', user: null, accessToken: null });
  document.documentElement.className = '';
});
