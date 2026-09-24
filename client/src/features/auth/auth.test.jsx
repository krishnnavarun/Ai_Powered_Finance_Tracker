import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { apiError, http, server, session, testUser } from '@/test/msw';
import { renderApp } from '@/test/utils';

const heading = (name) => screen.findByRole('heading', { level: 1, name });

// Records the JSON bodies sent to an endpoint and replies with `reply`.
function mockPost(path, reply) {
  const bodies = [];
  server.use(
    http.post(`*/api${path}`, async ({ request }) => {
      bodies.push(await request.json());
      return reply();
    }),
  );
  return bodies;
}

describe('route protection', () => {
  it('sends logged-out visitors to the login page and remembers where they were going', async () => {
    const { router } = renderApp('/budgets', { auth: 'signed-out' });

    expect(await heading('Welcome back')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.state.from.pathname).toBe('/budgets');
  });

  it('restores the session from the refresh cookie on start-up', async () => {
    server.use(http.post('*/api/auth/refresh', () => session('restored-token')));
    renderApp('/dashboard', { auth: 'restore' });

    expect(await heading('Dashboard')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('restored-token');
  });

  it('shows the login page when there is no session to restore', async () => {
    renderApp('/dashboard', { auth: 'restore' });
    expect(await heading('Welcome back')).toBeInTheDocument();
  });

  it('keeps logged-in users away from the login page', async () => {
    const { router } = renderApp('/login');
    expect(await heading('Dashboard')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });
});

describe('login page', () => {
  it('logs in and opens the dashboard', async () => {
    const user = userEvent.setup();
    const sent = mockPost('/auth/login', () => session());
    renderApp('/login', { auth: 'signed-out' });

    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'biryani2024');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await heading('Dashboard')).toBeInTheDocument();
    expect(sent).toEqual([{ email: 'asha@example.com', password: 'biryani2024' }]);
    expect(useAuthStore.getState().user).toEqual(testUser);
  });

  it('shows the server message when the password is wrong', async () => {
    const user = userEvent.setup();
    mockPost('/auth/login', () =>
      apiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password'),
    );
    renderApp('/login', { auth: 'signed-out' });

    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome back');
  });

  it('checks the form before sending anything', async () => {
    const user = userEvent.setup();
    const sent = mockPost('/auth/login', () => session());
    renderApp('/login', { auth: 'signed-out' });

    await user.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(sent).toHaveLength(0);
  });

  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    renderApp('/login', { auth: 'signed-out' });
    const password = await screen.findByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('links to the register page', async () => {
    const user = userEvent.setup();
    renderApp('/login', { auth: 'signed-out' });
    await user.click(await screen.findByRole('link', { name: 'Create an account' }));
    expect(await heading('Create your account')).toBeInTheDocument();
  });
});

describe('register page', () => {
  async function fillRegisterForm(user, { password = 'biryani2024' } = {}) {
    await user.type(await screen.findByLabelText('Name'), 'Asha Rao');
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), password);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
  }

  it('creates the account and opens the dashboard', async () => {
    const user = userEvent.setup();
    const sent = mockPost('/auth/register', () => session());
    renderApp('/register', { auth: 'signed-out' });

    await fillRegisterForm(user);

    expect(await heading('Dashboard')).toBeInTheDocument();
    expect(sent).toEqual([
      { name: 'Asha Rao', email: 'asha@example.com', password: 'biryani2024' },
    ]);
  });

  it('explains the password rules before sending', async () => {
    const user = userEvent.setup();
    const sent = mockPost('/auth/register', () => session());
    renderApp('/register', { auth: 'signed-out' });

    await fillRegisterForm(user, { password: 'onlyletters' });

    expect(await screen.findByText('Password must contain a number')).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it('shows "email already used" under the email field', async () => {
    const user = userEvent.setup();
    mockPost('/auth/register', () =>
      apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists'),
    );
    renderApp('/register', { auth: 'signed-out' });

    await fillRegisterForm(user);

    const email = screen.getByLabelText('Email');
    expect(
      await screen.findByText('An account with this email already exists'),
    ).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a general alert when the server is unreachable', async () => {
    const user = userEvent.setup();
    server.use(http.post('*/api/auth/register', () => Response.error()));
    renderApp('/register', { auth: 'signed-out' });

    await fillRegisterForm(user);

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server");
    within(screen.getByRole('alert')).getByText(/internet connection/);
  });
});
