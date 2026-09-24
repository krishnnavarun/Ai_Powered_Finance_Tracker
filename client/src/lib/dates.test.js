import { describe, expect, it } from 'vitest';
import { formatDate, startOfMonth, toLocalDate } from './dates';

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
