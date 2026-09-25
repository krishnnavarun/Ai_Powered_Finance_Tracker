import { describe, expect, it } from 'vitest';
import { describeSchedule, monthlyAmount, monthlyTotals } from './schedule';

describe('describeSchedule', () => {
  it.each([
    [{ frequency: 'daily', startDate: '2026-09-24' }, 'Every day'],
    [{ frequency: 'daily', interval: 3, startDate: '2026-09-24' }, 'Every 3 days'],
    [{ frequency: 'weekly', startDate: '2026-09-28' }, 'Every week on Monday'],
    [{ frequency: 'weekly', interval: 2, startDate: '2026-09-25' }, 'Every 2 weeks on Friday'],
    [{ frequency: 'monthly', startDate: '2026-10-01' }, 'Every month on the 1st'],
    [{ frequency: 'monthly', interval: 3, startDate: '2026-10-22' }, 'Every 3 months on the 22nd'],
    [
      { frequency: 'monthly', startDate: '2026-10-31' },
      'Every month on the 31st (or the last day)',
    ],
    [{ frequency: 'yearly', startDate: '2027-03-05' }, 'Every year on 5 March'],
  ])('%j → %s', (rule, expected) => expect(describeSchedule(rule)).toBe(expected));
});

describe('monthlyAmount', () => {
  const rule = (frequency, amount, interval = 1) => ({
    frequency,
    interval,
    template: { amount },
  });

  it('turns every schedule into an average month', () => {
    expect(monthlyAmount(rule('monthly', 1500000))).toBe(1500000);
    expect(monthlyAmount(rule('monthly', 300000, 3))).toBe(100000);
    expect(monthlyAmount(rule('yearly', 1200000))).toBe(100000);
    expect(monthlyAmount(rule('weekly', 70000))).toBe(304375); // ₹700 × 4.35 weeks
    expect(monthlyAmount(rule('daily', 10000))).toBe(304375); // ₹100 × 30.44 days
  });
});

describe('monthlyTotals', () => {
  it('adds active income and expense rules, skipping paused, finished and transfers', () => {
    const base = { frequency: 'monthly', interval: 1, active: true, nextDate: '2026-10-01' };
    const rules = [
      { ...base, template: { type: 'expense', amount: 1500000 } },
      { ...base, template: { type: 'expense', amount: 64900 } },
      { ...base, template: { type: 'income', amount: 6000000 } },
      { ...base, template: { type: 'transfer', amount: 500000 } },
      { ...base, active: false, template: { type: 'expense', amount: 99900 } },
      { ...base, nextDate: null, template: { type: 'expense', amount: 99900 } },
    ];
    expect(monthlyTotals(rules)).toEqual({ income: 6000000, expense: 1564900 });
  });
});
