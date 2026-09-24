import { describe, expect, it } from 'vitest';
import {
  addMonths,
  daysBetween,
  localDateOf,
  monthContaining,
  monthRange,
  previousMonth,
} from '../../src/utils/dates.js';
import { nextOccurrence, occurrence, upcomingOccurrences } from '../../src/utils/recurrence.js';

describe('addMonths', () => {
  it.each([
    ['2026-01-15', 1, undefined, '2026-02-15'],
    ['2026-01-31', 1, undefined, '2026-02-28'],
    ['2028-01-31', 1, undefined, '2028-02-29'], // leap year
    ['2026-02-28', 1, 31, '2026-03-31'], // back to the anchor day
    ['2026-11-30', 2, undefined, '2027-01-30'],
    ['2026-03-31', -1, undefined, '2026-02-28'],
    ['2026-01-10', -1, undefined, '2025-12-10'],
  ])('%s %+d months (anchor %s) → %s', (date, months, anchor, expected) => {
    expect(addMonths(date, months, anchor)).toBe(expected);
  });
});

describe('budget months', () => {
  const ist = { timeZone: 'Asia/Kolkata' };

  it('runs from the 1st to the last day by default', () => {
    const range = monthRange('2026-09', { ...ist, monthStartDay: 1 });
    expect(range).toMatchObject({ fromDate: '2026-09-01', toDate: '2026-09-30' });
    expect(range.start.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    expect(range.end.toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });

  it('can start on salary day', () => {
    expect(monthRange('2026-09', { ...ist, monthStartDay: 25 })).toMatchObject({
      fromDate: '2026-09-25',
      toDate: '2026-10-24',
    });
    expect(monthRange('2026-12', { ...ist, monthStartDay: 25 }).toDate).toBe('2027-01-24');
  });

  it('finds the budget month for a moment, in the user’s time zone', () => {
    // 20:00 UTC on 24 Sep is already 25 Sep in India → the new salary month.
    const moment = new Date('2026-09-24T20:00:00Z');
    expect(monthContaining(moment, { ...ist, monthStartDay: 25 })).toBe('2026-09');
    expect(monthContaining(moment, { timeZone: 'UTC', monthStartDay: 25 })).toBe('2026-08');
    expect(monthContaining(new Date('2026-01-10T06:00:00Z'), { ...ist, monthStartDay: 25 })).toBe(
      '2025-12',
    );
  });

  it('knows the previous month', () => {
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('counts days and reads local dates', () => {
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(29);
    expect(localDateOf(new Date('2026-09-23T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-09-24');
  });
});

describe('recurrence', () => {
  const monthly = { frequency: 'monthly', interval: 1 };

  it.each([
    [{ frequency: 'daily', interval: 1 }, 3, '2026-01-04'],
    [{ frequency: 'daily', interval: 2 }, 3, '2026-01-07'],
    [{ frequency: 'weekly', interval: 1 }, 2, '2026-01-15'],
    [{ frequency: 'weekly', interval: 2 }, 1, '2026-01-15'],
    [{ frequency: 'monthly', interval: 3 }, 1, '2026-04-01'],
    [{ frequency: 'yearly', interval: 1 }, 2, '2028-01-01'],
  ])('%j occurrence %i from 2026-01-01 → %s', (schedule, n, expected) => {
    expect(occurrence('2026-01-01', schedule, n)).toBe(expected);
  });

  it('keeps month-end rules on the right day without drifting', () => {
    const dates = [0, 1, 2, 3].map((n) => occurrence('2026-01-31', monthly, n));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('keeps 29 Feb yearly rules on 28 Feb in normal years', () => {
    const yearly = { frequency: 'yearly', interval: 1 };
    expect([0, 1, 4].map((n) => occurrence('2028-02-29', yearly, n))).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2032-02-29',
    ]);
  });

  it('finds the next date on or after a day', () => {
    expect(nextOccurrence('2026-01-31', monthly, '2026-03-01')).toBe('2026-03-31');
    expect(nextOccurrence('2026-01-31', monthly, '2026-03-31')).toBe('2026-03-31');
    expect(nextOccurrence('2026-05-10', monthly, '2026-01-01')).toBe('2026-05-10');
    expect(nextOccurrence('2020-01-01', { frequency: 'daily' }, '2026-09-24')).toBe('2026-09-24');
  });

  it('stops after the end date', () => {
    expect(nextOccurrence('2026-01-01', monthly, '2026-04-02', '2026-04-30')).toBeNull();
    expect(nextOccurrence('2026-01-01', monthly, '2026-03-02', '2026-04-30')).toBe('2026-04-01');
  });

  it('lists upcoming dates', () => {
    expect(upcomingOccurrences('2026-01-31', monthly, '2026-02-01', 3)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(upcomingOccurrences('2026-01-01', monthly, '2026-01-01', 5, '2026-03-15')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });
});
