import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { http, HttpResponse, server } from '@/test/msw';
import { renderApp } from '@/test/utils';

const ok = (data) => HttpResponse.json({ success: true, data });

function fakeNotifications() {
  let list = [
    {
      id: 'n1',
      kind: 'budget',
      title: 'Food budget is used up',
      body: 'You’ve spent ₹10,500 of ₹10,000.',
      link: '/insights',
      read: false,
      createdAt: '2026-09-24T04:00:00.000Z',
    },
    {
      id: 'n2',
      kind: 'digest',
      title: 'Your week: ₹15,600 spent',
      body: 'A steady week.',
      link: '/reports',
      read: false,
      createdAt: '2026-09-21T04:00:00.000Z',
    },
  ];
  const calls = [];
  server.use(
    http.get('*/api/notifications', () =>
      ok({ notifications: list, unread: list.filter((n) => !n.read).length }),
    ),
    http.patch('*/api/notifications/:id/read', ({ params }) => {
      calls.push(`read ${params.id}`);
      list = list.map((n) => (n.id === params.id ? { ...n, read: true } : n));
      return ok({ notification: list.find((n) => n.id === params.id) });
    }),
    http.post('*/api/notifications/read-all', () => {
      calls.push('read all');
      list = list.map((n) => ({ ...n, read: true }));
      return ok({ updated: 2 });
    }),
  );
  return calls;
}

describe('notification bell', () => {
  it('shows the unread count and opens a notification’s page', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const calls = fakeNotifications();
    const { router } = renderApp('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    const item = await screen.findByRole('menuitem', { name: /Food budget is used up/ });
    expect(item).toHaveTextContent('(unread)');
    await user.click(item);

    await waitFor(() => expect(router.state.location.pathname).toBe('/insights'));
    expect(calls).toEqual(['read n1']);
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeInTheDocument();
  });

  it('marks everything as read', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const calls = fakeNotifications();
    renderApp('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Notifications, 2 unread' }));
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }));

    await waitFor(() => expect(calls).toEqual(['read all']));
    await user.keyboard('{Escape}'); // close the menu
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });
});
