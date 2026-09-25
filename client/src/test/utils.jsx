import { render, screen } from '@testing-library/react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { vi } from 'vitest';
import { AppProviders } from '@/AppProviders';
import { createQueryClient } from '@/lib/queryClient';
import { routes } from '@/router';
import { useAuthStore } from '@/store/auth';
import { testUser } from './msw';

// Fakes window.matchMedia; `prefersDark` controls the OS dark-mode answer.
// Tests always "prefer reduced motion": animations are skipped and amounts show their
// final value at once, so results are exact and repeatable.
export function mockMatchMedia(prefersDark = false) {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('dark') ? prefersDark : query.includes('reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Waits for a toast message. Sonner renders each toast twice (visible + screen-reader
// announcement), so this accepts one or more matches.
export async function findToast(text) {
  const matches = await screen.findAllByText(text);
  return matches[0];
}

// Renders the real app routes at the given URL, without a browser.
// auth: 'signed-in'  — already logged in as testUser (default)
//       'signed-out' — known to be logged out
//       'restore'    — app starts up and asks the (fake) API for a session
// user: who is signed in (default testUser, who has finished onboarding)
export function renderApp(url = '/dashboard', { auth = 'signed-in', user = testUser } = {}) {
  if (auth === 'signed-in') {
    useAuthStore.setState({ status: 'authenticated', user, accessToken: 'test-token' });
  } else if (auth === 'signed-out') {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
  }

  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const result = render(
    <AppProviders queryClient={createQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, ...result };
}
