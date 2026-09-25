import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { installFakeApi } from '@/test/fakeApi';
import { apiError, http, server, session, testUser } from '@/test/msw';
import { renderApp } from '@/test/utils';

const demoUser = { ...testUser, name: 'Demo User', email: 'demo-1@demo.paisa-pal.invalid' };

describe('landing page', () => {
  it('introduces the app to visitors', async () => {
    renderApp('/', { auth: 'signed-out' });

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Save more. Worry less.',
    );
    expect(
      screen.getByRole('heading', { name: 'Find forgotten subscriptions' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /Create a free account/ })).toHaveAttribute(
      'href',
      '/register',
    );
    expect(document.title).toBe('Track your money with AI · Paisa Pal');
  });

  it('opens a demo account in one click', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'HDFC Savings' }] });
    server.use(http.post('*/api/auth/demo', () => session('demo-token', demoUser)));
    const { router } = renderApp('/', { auth: 'signed-out' });

    await user.click((await screen.findAllByRole('button', { name: 'Try the demo' }))[0]);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(useAuthStore.getState()).toMatchObject({
      status: 'authenticated',
      accessToken: 'demo-token',
      user: { name: 'Demo User' },
    });
  });

  it('shows a problem starting the demo', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('*/api/auth/demo', () =>
        apiError(429, 'TOO_MANY_REQUESTS', 'Too many sign-ups from this network.'),
      ),
    );
    renderApp('/', { auth: 'signed-out' });

    await user.click((await screen.findAllByRole('button', { name: 'Try the demo' }))[0]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-ups');
  });

  it('can start the demo from the login page', async () => {
    const user = userEvent.setup();
    installFakeApi();
    server.use(http.post('*/api/auth/demo', () => session('demo-token', demoUser)));
    const { router } = renderApp('/login', { auth: 'signed-out' });

    await user.click(await screen.findByRole('button', { name: 'Try the demo' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});
