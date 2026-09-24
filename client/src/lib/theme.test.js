import { describe, expect, it } from 'vitest';
import { mockMatchMedia } from '@/test/utils';
import { applyTheme, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['nonsense', true, 'light'],
  ])('%s with OS dark=%s → %s', (theme, prefersDark, expected) => {
    expect(resolveTheme(theme, prefersDark)).toBe(expected);
  });
});

describe('applyTheme', () => {
  it('adds the dark class for dark and removes it for light', () => {
    applyTheme('dark');
    expect(document.documentElement).toHaveClass('dark');
    applyTheme('light');
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('follows the OS when set to system', () => {
    mockMatchMedia(true);
    expect(applyTheme('system')).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });
});
