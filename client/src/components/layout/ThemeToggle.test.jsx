import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '@/lib/theme';
import { useUiStore } from '@/store/ui';
import { mockMatchMedia, renderApp } from '@/test/utils';

async function chooseTheme(user, label) {
  await user.click(await screen.findByRole('button', { name: 'Change theme' }));
  await user.click(await screen.findByRole('menuitemradio', { name: label }));
}

describe('theme toggle', () => {
  it('switches to dark and remembers the choice', async () => {
    const user = userEvent.setup();
    renderApp();

    await chooseTheme(user, 'Dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(useUiStore.getState().theme).toBe('dark');
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)).state.theme).toBe('dark');
  });

  it('switches back to light', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ theme: 'dark' });
    renderApp();

    await chooseTheme(user, 'Light');

    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows the OS setting in system mode', async () => {
    mockMatchMedia(true);
    const user = userEvent.setup();
    useUiStore.setState({ theme: 'light' });
    renderApp();

    await chooseTheme(user, 'System');

    expect(useUiStore.getState().theme).toBe('system');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('marks the current theme as checked', async () => {
    const user = userEvent.setup();
    useUiStore.setState({ theme: 'dark' });
    renderApp();

    await user.click(await screen.findByRole('button', { name: 'Change theme' }));

    expect(await screen.findByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
