import { render } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { AppProviders } from '@/AppProviders';
import { routes } from '@/router';

// Fakes window.matchMedia; `prefersDark` controls the OS dark-mode answer.
export function mockMatchMedia(prefersDark = false) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('dark') ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Renders the real app routes at the given URL, without a browser.
export function renderApp(url = '/dashboard') {
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const result = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...result };
}
