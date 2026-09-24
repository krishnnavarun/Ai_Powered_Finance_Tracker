import { describe, expect, it } from 'vitest';
import { firstName, initials } from './user';

describe('initials', () => {
  it.each([
    ['Asha Rao', 'AR'],
    ['asha', 'A'],
    ['  Ravi  Kumar  Sharma ', 'RS'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('firstName', () => {
  it('returns the first word of the name', () => {
    expect(firstName('Asha Rao')).toBe('Asha');
    expect(firstName('  Ravi ')).toBe('Ravi');
  });
});
