import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { http, HttpResponse, server, testUser } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';
import { useAuthStore } from '@/store/auth';

const newUser = { ...testUser, onboardingDone: false };

// Fakes PATCH /users/me and /users/me/settings, keeping every body sent.
function fakeUsersApi() {
  const sent = { profile: [], settings: [] };
  let user = { ...newUser };
  const reply = () => HttpResponse.json({ success: true, data: { user } });
  server.use(
    http.patch('*/api/users/me', async ({ request }) => {
      const body = await request.json();
      sent.profile.push(body);
      user = { ...user, ...body };
      return reply();
    }),
    http.patch('*/api/users/me/settings', async ({ request }) => {
      const body = await request.json();
      sent.settings.push(body);
      user = { ...user, settings: { ...user.settings, ...body } };
      return reply();
    }),
  );
  return sent;
}

const heading = (name) => screen.findByRole('heading', { level: 1, name });

describe('onboarding', () => {
  it('sends new users to setup before any other page', async () => {
    installFakeApi();
    const { router } = renderApp('/budgets', { user: newUser });

    await heading('Your month');
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('sends users who finished setup to the dashboard', async () => {
    installFakeApi();
    const { router } = renderApp('/onboarding');

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('walks through month, wallets and AI, then saves everything', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    const sent = fakeUsersApi();
    const { router } = renderApp('/onboarding', { user: newUser });

    // Step 1: month start day
    await heading('Your month');
    await user.selectOptions(screen.getByLabelText('My month starts on the'), '25');
    expect(screen.getByText(/run from the 25th to the 24th/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 2: wallets — nothing added yet, so the button offers to skip
    await heading('Your wallets');
    expect(screen.getByRole('button', { name: 'Skip this step' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Money in it now'), '52,000');
    await user.click(screen.getByRole('button', { name: 'Add wallet' }));

    const list = await screen.findByRole('region', { name: 'Wallets added' });
    expect(await within(list).findByText('Bank account')).toBeInTheDocument();
    expect(list).toHaveTextContent('₹52,000');
    expect(api.db.requests.at(-1).body).toMatchObject({
      name: 'Bank account',
      type: 'bank',
      openingBalance: 5200000,
    });
    // The next suggestion is cash.
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Name')).toHaveValue('Cash');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    // Step 3: AI
    await heading('AI helper');
    await user.click(screen.getByRole('radio', { name: /No, keep it off/ }));
    await user.click(screen.getByRole('button', { name: 'Finish' }));

    await findToast('All set! Welcome to Paisa Pal');
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(sent.settings).toEqual([{ aiEnabled: false }]);
    expect(sent.profile).toEqual([
      { monthStartDay: 25, timezone: expect.any(String), onboardingDone: true },
    ]);
    expect(useAuthStore.getState().user).toMatchObject({ onboardingDone: true, monthStartDay: 25 });
  });

  it('can go back a step without losing choices', async () => {
    const user = userEvent.setup();
    installFakeApi();
    renderApp('/onboarding', { user: newUser });

    await heading('Your month');
    await user.selectOptions(screen.getByLabelText('My month starts on the'), '5');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await heading('Your wallets');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    await heading('Your month');
    expect(screen.getByLabelText('My month starts on the')).toHaveValue('5');
  });

  it('can be skipped', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeUsersApi();
    const { router } = renderApp('/onboarding', { user: newUser });

    await heading('Your month');
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(sent.profile).toEqual([{ onboardingDone: true }]);
    expect(sent.settings).toEqual([]);
  });

  it('shows the error and stays when saving fails', async () => {
    const user = userEvent.setup();
    installFakeApi();
    server.use(
      http.patch('*/api/users/me/settings', () =>
        HttpResponse.json(
          { success: false, error: { code: 'INTERNAL', message: 'Something went wrong' } },
          { status: 500 },
        ),
      ),
    );
    const { router } = renderApp('/onboarding', { user: newUser });

    await heading('Your month');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Skip this step' }));
    await user.click(await screen.findByRole('button', { name: 'Finish' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(router.state.location.pathname).toBe('/onboarding');
  });
});
