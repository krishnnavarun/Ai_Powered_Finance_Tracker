import { describe, expect, it } from 'vitest';
import { budgetStatus, rolloverAmount } from '../../src/services/budget.math.js';
import { goalProgress, monthsUntil } from '../../src/services/goal.math.js';

describe('budgetStatus', () => {
  it('is ok while well under the limit, with a daily allowance', () => {
    expect(budgetStatus({ limit: 1000000, spent: 400000, daysLeft: 10 })).toEqual({
      effectiveLimit: 1000000,
      spent: 400000,
      remaining: 600000,
      percent: 40,
      status: 'ok',
      dailyAllowance: 60000, // ₹600 a day for 10 days
    });
  });

  it('warns from the lowest alert level', () => {
    expect(budgetStatus({ limit: 1000000, spent: 800000, daysLeft: 5 }).status).toBe('warning');
    expect(budgetStatus({ limit: 1000000, spent: 799999, daysLeft: 5 }).status).toBe('ok');
    expect(
      budgetStatus({ limit: 1000000, spent: 500000, daysLeft: 5, alertLevels: [50, 100] }).status,
    ).toBe('warning');
  });

  it('does not round a nearly-used budget up to "over"', () => {
    expect(budgetStatus({ limit: 1000000, spent: 999995, daysLeft: 1 })).toMatchObject({
      status: 'warning',
      percent: 99,
      remaining: 5,
    });
  });

  it('is over at 100% and shows a negative remaining', () => {
    const over = budgetStatus({ limit: 1000000, spent: 1250000, daysLeft: 3 });
    expect(over).toMatchObject({
      status: 'over',
      remaining: -250000,
      percent: 125,
      dailyAllowance: 0,
    });
    expect(budgetStatus({ limit: 1000000, spent: 1000000, daysLeft: 3 }).status).toBe('over');
  });

  it('adds rolled-over money to the limit', () => {
    expect(
      budgetStatus({ limit: 1000000, spent: 1100000, rollover: 200000, daysLeft: 1 }),
    ).toMatchObject({
      effectiveLimit: 1200000,
      remaining: 100000,
      status: 'warning',
    });
  });

  it('has no daily allowance once the month is over', () => {
    expect(budgetStatus({ limit: 1000000, spent: 0, daysLeft: 0 }).dailyAllowance).toBe(0);
  });
});

describe('rolloverAmount', () => {
  it('carries unspent money only when rollover is on', () => {
    expect(rolloverAmount({ enabled: true, previousLimit: 1000000, previousSpent: 700000 })).toBe(
      300000,
    );
    expect(rolloverAmount({ enabled: false, previousLimit: 1000000, previousSpent: 700000 })).toBe(
      0,
    );
    // No budget last month → nothing to carry.
    expect(rolloverAmount({ enabled: true, previousLimit: undefined, previousSpent: 0 })).toBe(0);
  });

  it('never carries overspending', () => {
    expect(rolloverAmount({ enabled: true, previousLimit: 1000000, previousSpent: 1500000 })).toBe(
      0,
    );
  });
});

describe('goals', () => {
  const goal = { targetAmount: 6000000, savedAmount: 1500000, status: 'active' };

  it('counts the months left to save in, including this one', () => {
    expect(monthsUntil('2026-09-24', '2026-12-31')).toBe(4);
    expect(monthsUntil('2026-09-24', '2026-09-30')).toBe(1);
    expect(monthsUntil('2026-09-24', '2027-03-01')).toBe(7);
  });

  it('works out the monthly saving needed to hit the deadline', () => {
    expect(goalProgress({ ...goal, deadline: '2026-12-31' }, '2026-09-24')).toEqual({
      percent: 25,
      remaining: 4500000,
      monthsLeft: 4,
      requiredPerMonth: 1125000, // ₹11,250 a month
      overdue: false,
    });
  });

  it('rounds the monthly amount up so the goal is always reached', () => {
    const { requiredPerMonth } = goalProgress(
      { targetAmount: 1000000, savedAmount: 0, status: 'active', deadline: '2026-11-30' },
      '2026-09-01',
    );
    expect(requiredPerMonth * 3).toBeGreaterThanOrEqual(1000000);
    expect(requiredPerMonth).toBe(333334);
  });

  it('flags a missed deadline', () => {
    expect(goalProgress({ ...goal, deadline: '2026-08-31' }, '2026-09-24')).toMatchObject({
      overdue: true,
      requiredPerMonth: null,
    });
  });

  it('needs nothing more once reached, paused, or without a deadline', () => {
    expect(
      goalProgress({ ...goal, savedAmount: 7000000, deadline: '2026-12-31' }, '2026-09-24'),
    ).toMatchObject({
      percent: 100,
      remaining: 0,
      requiredPerMonth: null,
    });
    expect(
      goalProgress({ ...goal, status: 'paused', deadline: '2026-12-31' }, '2026-09-24')
        .requiredPerMonth,
    ).toBeNull();
    expect(goalProgress({ ...goal, deadline: null }, '2026-09-24').requiredPerMonth).toBeNull();
  });
});
