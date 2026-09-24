import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { refreshSession } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { http, HttpResponse, server, session } from '@/test/msw';
import { renderApp } from '@/test/utils';

const heading = (name) => screen.findByRole('heading', { level: 1, name });

async function logIn(user) {
  server.use(http.post('*/api/auth/login', () => session()));
  await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
  await user.type(screen.getByLabelText('Password'), 'biryani2024');
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

async function openAccountMenu(user) {
  await user.click(await screen.findByRole('button', { name: 'Account menu' }));
  return screen.findByRole('menu');
}

describe('after logging in', () => {
  it('returns to the page the user originally asked for', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/budgets?month=2026-09', { auth: 'signed-out' });

    await logIn(user);

    expect(await heading('Budgets')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/budgets');
    expect(router.state.location.search).toBe('?month=2026-09');
  });

  it('greets the user by first name on the dashboard', async () => {
    renderApp('/dashboard');
    expect(await screen.findByText("Hi Asha, here's your money today")).toBeInTheDocument();
  });
});

describe('account menu', () => {
  it('shows who is logged in', async () => {
    const user = userEvent.setup();
    renderApp();
    // Check the avatar before opening: an open menu hides the rest of the page from
    // screen readers (aria-hidden), so the trigger can't be queried by role then.
    expect(await screen.findByRole('button', { name: 'Account menu' })).toHaveTextContent('AR');

    const menu = await openAccountMenu(user);

    expect(within(menu).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(menu).getByText('asha@example.com')).toBeInTheDocument();
  });

  it('opens settings', async () => {
    const user = userEvent.setup();
    renderApp();
    const menu = await openAccountMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: 'Settings' }));
    expect(await heading('Settings')).toBeInTheDocument();
  });

  it('logs out: tells the server, clears the session and shows the login page', async () => {
    const user = userEvent.setup();
    let logoutCalls = 0;
    server.use(
      http.post('*/api/auth/logout', () => {
        logoutCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderApp('/budgets');
    const menu = await openAccountMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    expect(await heading('Welcome back')).toBeInTheDocument();
    expect(logoutCalls).toBe(1);
    expect(useAuthStore.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      accessToken: null,
      endReason: 'logout',
    });
    // A deliberate logout doesn't remember the old page or show "session expired".
    expect(router.state.location.state).toBeFalsy();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it('still logs out on this device when the server is unreachable', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/auth/logout', () => HttpResponse.error()));
    renderApp();
    const menu = await openAccountMenu(user);

    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    expect(await heading('Welcome back')).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});

describe('when the session expires', () => {
  it('explains why on the login page and returns to the same page afterwards', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/goals');
    expect(await heading('Goals')).toBeInTheDocument();

    // The refresh cookie has expired (default fake API answers 401).
    await act(() => refreshSession().catch(() => {}));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Your session expired. Please log in again.',
    );
    expect(router.state.location.state.from.pathname).toBe('/goals');

    await logIn(user);
    expect(await heading('Goals')).toBeInTheDocument();
  });
});
