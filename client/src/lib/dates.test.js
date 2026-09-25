import { describe, expect, it } from 'vitest';
import { formatDate, formatMonth, shiftMonth, startOfMonth, toLocalDate, ordinal } from './dates';

describe('toLocalDate', () => {
  it('uses the time zone to decide the calendar day', () => {
    // 20:00 UTC on the 23rd is already the 24th in India.
    expect(toLocalDate('2026-09-23T20:00:00Z', 'Asia/Kolkata')).toBe('2026-09-24');
    expect(toLocalDate('2026-09-23T20:00:00Z', 'UTC')).toBe('2026-09-23');
  });
});

describe('formatDate', () => {
  it('shows a short Indian-style date', () => {
    // Newer Intl data spells the Indian short month "Sept"; older versions "Sep".
    expect(formatDate('2026-09-23T18:30:00Z', 'Asia/Kolkata')).toMatch(/^24 Sept? 2026$/);
  });
});

describe('startOfMonth', () => {
  it('returns the first day of the month', () => {
    expect(startOfMonth('2026-09-24')).toBe('2026-09-01');
  });
});

describe('months', () => {
  it('formats month labels', () => {
    expect(formatMonth('2026-09')).toMatch(/^Sept?$/);
    expect(formatMonth('2026-09', { long: true })).toBe('September 2026');
  });

  it('moves between months across years', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });
});

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [28, '28th'],
  ])('%i → %s', (day, expected) => expect(ordinal(day)).toBe(expected));
});
