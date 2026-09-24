import { describe, expect, it } from 'vitest';
import { redirectTarget } from './redirect';

describe('redirectTarget', () => {
  it('goes to the dashboard when there is no saved page', () => {
    expect(redirectTarget(undefined)).toBe('/dashboard');
    expect(redirectTarget({})).toBe('/dashboard');
  });

  it('keeps the path, query and hash of the saved page', () => {
    expect(redirectTarget({ pathname: '/budgets', search: '?month=2026-09', hash: '#food' })).toBe(
      '/budgets?month=2026-09#food',
    );
  });

  it('never sends the user back to login or register', () => {
    expect(redirectTarget({ pathname: '/login' })).toBe('/dashboard');
    expect(redirectTarget({ pathname: '/register' })).toBe('/dashboard');
  });
});
