import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/store/auth';
import { installFakeApi } from '@/test/fakeApi';
import { apiError, http, HttpResponse, server, testUser } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

const ok = (data, status = 200) => HttpResponse.json({ success: true, data }, { status });

function fakeUsers() {
  const sent = { profile: [], settings: [], deleted: [], categories: [] };
  let user = { ...testUser };
  server.use(
    http.patch('*/api/users/me', async ({ request }) => {
      const body = await request.json();
      sent.profile.push(body);
      user = { ...user, ...body };
      return ok({ user });
    }),
    http.patch('*/api/users/me/settings', async ({ request }) => {
      const body = await request.json();
      sent.settings.push(body);
      user = { ...user, settings: { ...user.settings, ...body } };
      return ok({ user });
    }),
    http.get(
      '*/api/users/me/export',
      () =>
        new HttpResponse(JSON.stringify({ user }), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="paisa-pal-export-2026-09-25.json"',
          },
        }),
    ),
    http.delete('*/api/users/me', async ({ request }) => {
      const { password } = await request.json();
      if (password !== 'password123')
        return apiError(400, 'WRONG_PASSWORD', 'That password is not right');
      sent.deleted.push(true);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return sent;
}

describe('settings page', () => {
  it('saves the profile', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeUsers();
    renderApp('/settings');

    const profile = await screen.findByRole('form', { name: 'Profile' });
    const name = within(profile).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'Asha K');
    await user.selectOptions(within(profile).getByLabelText('Month starts on the'), '25');
    await user.click(within(profile).getByRole('button', { name: 'Save profile' }));

    await findToast('Profile saved');
    expect(sent.profile).toEqual([{ name: 'Asha K', monthStartDay: 25, timezone: 'Asia/Kolkata' }]);
    expect(useAuthStore.getState().user).toMatchObject({ name: 'Asha K', monthStartDay: 25 });
  });

  it('turns AI off with a switch', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeUsers();
    renderApp('/settings');

    const ai = await screen.findByRole('switch', { name: 'AI helper' });
    expect(ai).toBeChecked();
    expect(ai).toHaveAccessibleDescription(/Card numbers, phone numbers and emails are hidden/);
    await user.click(ai);

    await findToast('AI helper turned off');
    expect(sent.settings).toEqual([{ aiEnabled: false }]);
    expect(screen.getByRole('switch', { name: 'AI helper' })).not.toBeChecked();
  });

  it('adds, renames and hides categories', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    const writes = [];
    server.use(
      http.post('*/api/categories', async ({ request }) => {
        const body = await request.json();
        writes.push(['POST', body]);
        const category = {
          id: 'new1',
          icon: 'tag',
          color: '#94a3b8',
          parentId: null,
          isArchived: false,
          ...body,
        };
        api.db.categories.push(category);
        return ok({ category }, 201);
      }),
      http.patch('*/api/categories/:id', async ({ params, request }) => {
        const body = await request.json();
        writes.push(['PATCH', params.id, body]);
        const category = api.db.categories.find((c) => c.id === params.id);
        Object.assign(category, body);
        return ok({ category });
      }),
    );
    renderApp('/settings');

    const section = await screen.findByRole('region', { name: 'Categories' });
    await user.type(within(section).getByLabelText('New category name'), 'Pets');
    await user.click(within(section).getByRole('button', { name: 'Add' }));
    await findToast('Added "Pets"');
    expect(await within(section).findByText('Pets')).toBeInTheDocument();

    await user.click(within(section).getByRole('button', { name: 'Rename Groceries' }));
    const input = within(section).getByLabelText('New name for Groceries');
    await user.clear(input);
    await user.type(input, 'Kirana{Enter}');
    await findToast('Renamed to "Kirana"');

    await user.click(within(section).getByRole('button', { name: 'Hide Transport' }));
    await findToast('"Transport" hidden');

    const groceries = api.db.categories.find((c) => c.name === 'Kirana');
    const transport = api.db.categories.find((c) => c.name === 'Transport');
    expect(writes).toEqual([
      ['POST', { name: 'Pets', type: 'expense' }],
      ['PATCH', groceries.id, { name: 'Kirana' }],
      ['PATCH', transport.id, { isArchived: true }],
    ]);
  });

  it('downloads all data', async () => {
    const user = userEvent.setup();
    installFakeApi();
    fakeUsers();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: 'Download my data' }));

    await findToast('Downloaded paisa-pal-export-2026-09-25.json');
    expect(click.mock.instances[0].download).toBe('paisa-pal-export-2026-09-25.json');
    click.mockRestore();
  });

  it('deletes the account after the password, then logs out', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeUsers();
    const { router } = renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: 'Delete account' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete your account?' });
    await user.type(within(dialog).getByLabelText('Your password'), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: 'Delete everything' }));
    expect(await within(dialog).findByText('That password is not right')).toBeInTheDocument();

    const password = within(dialog).getByLabelText('Your password');
    await user.clear(password);
    await user.type(password, 'password123');
    await user.click(within(dialog).getByRole('button', { name: 'Delete everything' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(sent.deleted).toEqual([true]);
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});

describe('keyboard shortcuts', () => {
  it('N opens a new transaction and / goes to search', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'Cash', type: 'cash' }] });
    const { router } = renderApp('/dashboard');
    await screen.findByRole('heading', { name: 'Dashboard' });

    await user.keyboard('n');
    expect(await screen.findByRole('dialog', { name: 'Add a transaction' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/transactions');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await user.keyboard('/');
    expect(screen.getByLabelText('Search transactions')).toHaveFocus();
    // Typing in a box doesn't trigger shortcuts.
    await user.keyboard('n');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Search transactions')).toHaveValue('n');
  });
});
