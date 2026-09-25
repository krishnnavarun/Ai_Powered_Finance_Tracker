import { describe, expect, it } from 'vitest';
import { duplicateCharges, spendingAnomalies } from '../../src/ai/analytics/anomaly.js';
import { suggestBudgets } from '../../src/ai/analytics/budgetSuggest.js';
import { emaDaily, forecastMonthEnd } from '../../src/ai/analytics/forecast.js';
import { healthScore } from '../../src/ai/analytics/healthScore.js';
import { median, roundUpToHundredRupees, std } from '../../src/ai/analytics/stats.js';
import { detectSubscriptions } from '../../src/ai/analytics/subscriptions.js';
import { simulateWhatIf } from '../../src/ai/analytics/whatIf.js';

describe('stats', () => {
  it('computes median, spread and rounding', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(std([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(roundUpToHundredRupees(1460733)).toBe(1470000);
    expect(roundUpToHundredRupees(630000)).toBe(630000);
  });
});

describe('forecast', () => {
  it('weights recent days more (EMA, α = 0.3)', () => {
    expect(emaDaily([100, 0])).toBe(70);
    expect(emaDaily([0, 50000], { seed: 60000 })).toBeCloseTo(0.3 * 50000 + 0.7 * 42000);
    expect(emaDaily([], { seed: 500 })).toBe(500);
  });

  const input = {
    monthStart: '2026-09-01',
    today: '2026-09-05',
    monthEnd: '2026-09-30',
    balance: 8000000,
    seedDaily: 60000,
    days: [
      // Salary in; rent out through a recurring rule (not part of the daily average).
      { date: '2026-09-01', income: 6000000, expense: 1500000, recurringExpense: 1500000 },
      { date: '2026-09-02', income: 0, expense: 50000 },
      { date: '2026-09-04', income: 0, expense: 100000 },
      { date: '2026-09-05', income: 0, expense: 50000 },
    ],
    upcoming: [
      { date: '2026-09-15', type: 'expense', amount: 64900 },
      { date: '2026-09-30', type: 'income', amount: 500000 },
    ],
    budgets: [{ categoryId: 'food', limit: 600000, spent: 200000 }],
  };

  it('predicts the month-end balance from the daily average and known payments', () => {
    const result = forecastMonthEnd(input);
    // Daily spend so far: 0, 500, 0, 1000, 500 (₹) → EMA seeded with ₹600 = ₹512.29
    expect(result.averageDaily).toBe(51229);
    expect(result.daysLeft).toBe(25);
    expect(result.upcomingExpense).toBe(64900);
    expect(result.upcomingIncome).toBe(500000);
    expect(result.predictedEnd).toBe(8000000 - 51229 * 25 - 64900 + 500000);
    expect(result.warning).toBeNull();
  });

  it('draws the past from real flows and the future from the forecast', () => {
    const { series, predictedEnd } = forecastMonthEnd(input);
    expect(series).toHaveLength(30);
    expect(series[0]).toEqual({ date: '2026-09-01', actual: 8200000 });
    expect(series[2]).toEqual({ date: '2026-09-03', actual: 8150000 });
    expect(series[4]).toEqual({ date: '2026-09-05', actual: 8000000, predicted: 8000000 });
    expect(series[5]).toEqual({ date: '2026-09-06', predicted: 8000000 - 51229 });
    expect(series.at(-1)).toEqual({ date: '2026-09-30', predicted: predictedEnd });
  });

  it('projects each budget at today’s pace', () => {
    expect(forecastMonthEnd(input).budgets).toEqual([
      { categoryId: 'food', limit: 600000, spent: 200000, projected: 1200000, willExceed: true },
    ]);
  });

  it('warns when money runs low or out', () => {
    // ₹12,000 − ₹8,456.25 leaves ₹3,543.75: under a week of spending (₹3,586).
    expect(forecastMonthEnd({ ...input, balance: 1200000 }).warning).toBe('low');
    expect(forecastMonthEnd({ ...input, balance: 500000 }).warning).toBe('negative');
  });

  it('works on the last day of the month', () => {
    const result = forecastMonthEnd({ ...input, today: '2026-09-30', upcoming: [] });
    expect(result.daysLeft).toBe(0);
    expect(result.predictedEnd).toBe(input.balance);
  });
});

describe('spendingAnomalies', () => {
  const steady = [100000, 120000, 90000, 110000, 100000, 95000, 105000, 100000];

  it('flags weeks far above normal (z > 2) and over ₹500', () => {
    const result = spendingAnomalies([
      { categoryId: 'food', history: steady, thisWeek: 300000 },
      { categoryId: 'normal', history: steady, thisWeek: 110000 },
      { categoryId: 'small', history: [1, 2, 3, 1, 2, 3, 1, 2], thisWeek: 40000 },
      { categoryId: 'new', history: [0, 0, 0, 0, 0, 0, 0, 50000], thisWeek: 900000 },
      { categoryId: 'flat', history: Array(8).fill(60000), thisWeek: 200000 },
    ]);
    expect(result.map((r) => r.categoryId)).toEqual(['food', 'flat']);
    expect(result[0]).toMatchObject({ thisWeek: 300000, average: 102500, std: 8660, z: 22.8 });
    expect(result[1]).toMatchObject({ average: 60000, std: 0, z: null });
  });
});

describe('duplicateCharges', () => {
  it('finds the same amount at the same merchant within 24 hours', () => {
    const at = (iso) => new Date(iso);
    const pairs = duplicateCharges([
      {
        id: '1',
        merchantKey: 'swiggy',
        amount: 25000,
        date: at('2026-09-24T10:00:00Z'),
        type: 'expense',
      },
      {
        id: '2',
        merchantKey: 'swiggy',
        amount: 25000,
        date: at('2026-09-24T20:00:00Z'),
        type: 'expense',
      },
      {
        id: '3',
        merchantKey: 'swiggy',
        amount: 25000,
        date: at('2026-09-26T10:00:00Z'),
        type: 'expense',
      },
      {
        id: '4',
        merchantKey: 'uber',
        amount: 25000,
        date: at('2026-09-24T10:30:00Z'),
        type: 'expense',
      },
      {
        id: '5',
        merchantKey: 'swiggy',
        amount: 25000,
        date: at('2026-09-24T11:00:00Z'),
        type: 'income',
      },
      {
        id: '6',
        merchantKey: '',
        amount: 25000,
        date: at('2026-09-24T10:05:00Z'),
        type: 'expense',
      },
    ]);
    expect(pairs).toEqual([
      { ids: ['1', '2'], merchantKey: 'swiggy', merchant: 'swiggy', amount: 25000, hoursApart: 10 },
    ]);
  });
});

describe('detectSubscriptions', () => {
  const charges = (merchantKey, amount, dates, merchant = merchantKey) =>
    dates.map((date, i) => ({
      merchantKey,
      merchant,
      amount: Array.isArray(amount) ? amount[i] : amount,
      date,
    }));

  it('finds weekly, monthly and yearly charges and skips irregular ones', () => {
    const found = detectSubscriptions(
      [
        ...charges(
          'netflix',
          64900,
          ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05'],
          'Netflix',
        ),
        ...charges('cult', 50000, ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'], 'Cult'),
        ...charges('hotstar', 149900, ['2024-01-10', '2025-01-12', '2026-01-09'], 'Hotstar'),
        ...charges('prime', 29900, ['2026-04-01', '2026-05-01', '2026-06-01'], 'Prime'),
        // Amounts too different
        ...charges('spotify', [11900, 11900, 13900], ['2026-07-01', '2026-08-01', '2026-09-01']),
        // Irregular gaps
        ...charges('swiggy', 25000, ['2026-09-01', '2026-09-04', '2026-09-16']),
        // Only twice
        ...charges('jio', 29900, ['2026-08-10', '2026-09-10']),
      ],
      { today: '2026-09-24' },
    );

    expect(found.map((s) => [s.merchantKey, s.period, s.yearlyCost])).toEqual([
      ['cult', 'weekly', 2600000],
      ['netflix', 'monthly', 778800],
      ['prime', 'monthly', 358800],
      ['hotstar', 'yearly', 149900],
    ]);
    expect(found[1]).toMatchObject({
      displayName: 'Netflix',
      avgAmount: 64900,
      chargeCount: 4,
      lastChargedAt: '2026-09-05',
      nextExpectedAt: '2026-10-05',
      late: false,
    });
    expect(found[0].nextExpectedAt).toBe('2026-09-29');
    expect(found[3].nextExpectedAt).toBe('2027-01-09');
    // Prime was expected on 1 Jul and never came again.
    expect(found[2].late).toBe(true);
  });
});

describe('healthScore', () => {
  it('gives full marks for a strong position', () => {
    const result = healthScore({
      months: Array(6).fill({ income: 10000000, expense: 7000000 }),
      budgets: [
        { limit: 100, spent: 90 },
        { limit: 100, spent: 100 },
      ],
      goals: [{ status: 'active', targetAmount: 1000, savedAmount: 500, expectedPercent: 50 }],
      liquid: 21000000,
    });
    expect(result.score).toBe(100);
    expect(result.grade).toBe('Great');
    expect(result.parts.map((p) => [p.key, p.score, p.max])).toEqual([
      ['savings', 35, 35],
      ['budgets', 25, 25],
      ['stability', 15, 15],
      ['goals', 15, 15],
      ['buffer', 10, 10],
    ]);
    expect(result.parts.find((p) => p.key === 'buffer').value).toBe(3);
  });

  it('scores the parts it can and gives a tip for each', () => {
    const result = healthScore({
      months: [
        { income: 10000000, expense: 9000000 },
        { income: 10000000, expense: 6000000 },
        { income: 10000000, expense: 12000000 },
      ],
      budgets: [
        { limit: 100, spent: 150 },
        { limit: 100, spent: 50 },
      ],
      goals: [{ status: 'active', targetAmount: 1000, savedAmount: 100, expectedPercent: 60 }],
      liquid: 9000000,
    });
    const byKey = Object.fromEntries(result.parts.map((p) => [p.key, p]));
    // (30L − 27L) / 30L = 10% saved → half of 35
    expect(byKey.savings).toMatchObject({ score: 18, value: 10 });
    expect(byKey.savings.tip).toContain('Aim for 20%');
    expect(byKey.budgets).toMatchObject({ score: 13, value: 50 });
    // Spending 90k/60k/1.2L: spread 0.27 of the average
    expect(byKey.stability.value).toBe(0.27);
    expect(byKey.stability.score).toBe(9);
    expect(byKey.goals).toMatchObject({ score: 0, value: 0 });
    // ₹90k covers 1 month of ₹90k average spending
    expect(byKey.buffer).toMatchObject({ value: 1, score: 3 });
    expect(result.score).toBe(18 + 13 + 9 + 0 + 3);
    expect(result.grade).toBe('Fair');
  });

  it('is fair to a brand-new user', () => {
    const result = healthScore({ months: [{ income: 0, expense: 500000 }] });
    expect(result.parts.map((p) => p.score)).toEqual([0, 15, 10, 8, 0]);
    expect(result.score).toBe(33);
    expect(result.grade).toBe('Needs care');
    expect(result.parts.every((p) => p.tip)).toBe(true);
  });
});

describe('suggestBudgets', () => {
  const categories = [
    { categoryId: 'rent', systemKey: 'rent', months: [1500000, 1500000, 1500000] },
    { categoryId: 'food', systemKey: 'food_dining', months: [800000, 1000000, 900000] },
    { categoryId: 'shopping', systemKey: 'shopping', months: [300000, 500000, 100000] },
    { categoryId: 'sip', systemKey: 'investments', months: [500000, 500000, 500000] },
    { categoryId: 'groceries', systemKey: 'groceries', months: [400000, 420000, 410000] },
    { categoryId: 'unused', systemKey: 'gifts', months: [0, 0, 0] },
  ];

  it('starts from the median month and trims wants, then needs, to save 20%', () => {
    const result = suggestBudgets({ categories, income: 4000000 });
    expect(result.suggestions.map((s) => [s.categoryId, s.kind, s.suggested])).toEqual([
      ['rent', 'need', 1470000],
      ['food', 'want', 630000],
      ['sip', 'saving', 500000],
      ['groceries', 'need', 400000],
      ['shopping', 'want', 210000],
    ]);
    expect(result.suggestions.find((s) => s.categoryId === 'food')).toMatchObject({
      median: 900000,
      trimmedBy: 270000,
    });
    expect(result).toMatchObject({
      medianTotal: 3610000,
      suggestedTotal: 3210000,
      projectedSavingsRate: 20,
      reachesTarget: true,
    });
  });

  it('only rounds when spending already fits, or income is unknown', () => {
    const fits = suggestBudgets({ categories, income: 10000000 });
    expect(fits.suggestions.every((s) => s.trimmedBy === 0)).toBe(true);

    const noIncome = suggestBudgets({ categories, income: 0 });
    expect(noIncome.projectedSavingsRate).toBeNull();
    expect(noIncome.reachesTarget).toBeNull();
    expect(noIncome.suggestions.find((s) => s.categoryId === 'shopping').suggested).toBe(300000);
  });
});

describe('simulateWhatIf', () => {
  const base = {
    income: 5000000,
    expense: 4000000,
    byCategory: [
      { categoryId: 'food', average: 1000000 },
      { categoryId: 'shopping', average: 500000 },
    ],
    today: '2026-09-24',
  };

  it('shows the new savings and how much sooner goals are reached', () => {
    const result = simulateWhatIf({
      ...base,
      changes: [{ categoryId: 'food', changePercent: -20 }],
      goals: [
        { id: 'g1', name: 'Phone', targetAmount: 6000000, savedAmount: 1200000 },
        { id: 'g2', name: 'Done', targetAmount: 100, savedAmount: 100 },
      ],
    });
    expect(result).toMatchObject({
      before: { expense: 4000000, savings: 1000000 },
      after: { expense: 3800000, savings: 1200000 },
      savingsChange: 200000,
      yearlySavingsChange: 2400000,
      changes: [
        {
          categoryId: 'food',
          changePercent: -20,
          before: 1000000,
          after: 800000,
          difference: -200000,
        },
      ],
    });
    expect(result.goals[0]).toEqual({
      goalId: 'g1',
      name: 'Phone',
      remaining: 4800000,
      before: { months: 5, date: '2027-02-24' },
      after: { months: 4, date: '2027-01-24' },
      monthsSooner: 1,
    });
    expect(result.goals[1].after).toEqual({ months: 0, date: '2026-09-24' });
  });

  it('says "never" when nothing is saved', () => {
    const result = simulateWhatIf({
      ...base,
      income: 3000000,
      changes: [{ categoryId: 'shopping', changePercent: 10 }],
      goals: [{ id: 'g1', name: 'Phone', targetAmount: 6000000, savedAmount: 0 }],
    });
    expect(result.after.savings).toBe(-1050000);
    expect(result.goals[0].after).toEqual({ months: null, date: null });
    expect(result.goals[0].monthsSooner).toBeNull();
  });
});
