import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { useUiStore } from '@/store/ui';
import { mockMatchMedia } from './utils';

// jsdom lacks a few browser APIs that Radix UI and our theme code use.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  useUiStore.setState({ theme: 'system' });
  document.documentElement.className = '';
});
