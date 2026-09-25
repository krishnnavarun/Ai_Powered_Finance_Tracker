import { describe, expect, it } from 'vitest';
import { budgetMonthRange, currentBudgetMonth, periodRange } from './periods';

const ist = { timeZone: 'Asia/Kolkata', now: new Date('2026-09-24T06:30:00Z') };

describe('report periods', () => {
  it('gives calendar months by default', () => {
    expect(periodRange('this-month', ist)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('last-month', ist)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(periodRange('last-3-months', ist)).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(periodRange('this-year', ist)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('follows a salary-day month', () => {
    // On 24 Sep with months starting on the 25th, "this month" began on 25 Aug.
    expect(periodRange('this-month', { ...ist, startDay: 25 })).toEqual({
      from: '2026-08-25',
      to: '2026-09-24',
    });
    expect(budgetMonthRange('2026-12', 25)).toEqual({ from: '2026-12-25', to: '2027-01-24' });
    expect(currentBudgetMonth('2026-01-10', 25)).toBe('2025-12');
  });
});
