import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from '@/lib/navigation';
import { renderApp } from '@/test/utils';

const heading = (name) => screen.findByRole('heading', { level: 1, name });

describe('app layout and routing', () => {
  it('redirects / to the dashboard and sets the tab title', async () => {
    const { router } = renderApp('/');
    expect(await heading('Dashboard')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    await waitFor(() => expect(document.title).toBe('Dashboard · Paisa Pal'));
  });

  it('shows every page in the sidebar', async () => {
    renderApp();
    const sidebar = await screen.findByRole('navigation', { name: 'Main' });
    for (const item of NAV_ITEMS) {
      expect(within(sidebar).getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.path,
      );
    }
  });

  it('navigates from the sidebar and marks the active link', async () => {
    const user = userEvent.setup();
    renderApp();
    const sidebar = await screen.findByRole('navigation', { name: 'Main' });

    await user.click(within(sidebar).getByRole('link', { name: 'Settings' }));

    expect(await heading('Settings')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Preferences' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(sidebar).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('shows a 404 page for unknown URLs with a way back', async () => {
    const user = userEvent.setup();
    renderApp('/no-such-page');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Go to dashboard' }));
    expect(await heading('Dashboard')).toBeInTheDocument();
  });

  it('has a skip link to the main content', async () => {
    renderApp();
    expect(await screen.findByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });
});

describe('mobile navigation', () => {
  it('shows 4 main tabs and a More button', async () => {
    renderApp();
    const mobile = await screen.findByRole('navigation', { name: 'Mobile' });
    const tabs = within(mobile)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(tabs).toEqual(['Dashboard', 'Transactions', 'Budgets', 'Assistant']);
    expect(within(mobile).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });

  it('opens the More sheet and navigates to a page in it', async () => {
    const user = userEvent.setup();
    renderApp();
    const mobile = await screen.findByRole('navigation', { name: 'Mobile' });

    await user.click(within(mobile).getByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    await user.click(within(sheet).getByRole('link', { name: 'Settings' }));

    expect(await heading('Settings')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
