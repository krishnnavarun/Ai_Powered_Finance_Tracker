import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { addDays } from '../../src/utils/dates.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';

let app;
let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // Thursday 24 Sep 2026 in India
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

async function add(fields) {
  const res = await asha.post('/api/transactions').send({
    type: 'expense',
    walletId: wallets.bank.id,
    ...fields,
  });
  expect(res.status).toBe(201);
  return res.body.data.transaction;
}

// Three normal months (June–August) of salary, rent and food.
async function addHistory() {
  for (const month of ['06', '07', '08']) {
    await add({
      type: 'income',
      amount: 6000000,
      categoryId: category.Salary.id,
      date: `2026-${month}-01`,
    });
    await add({
      amount: 1500000,
      categoryId: category.Rent.id,
      merchant: 'Landlord',
      date: `2026-${month}-02`,
    });
    await add({
      amount: 900000,
      categoryId: category['Food & Dining'].id,
      date: `2026-${month}-10`,
    });
  }
}

describe('GET /api/ai/forecast', () => {
  it('predicts the month-end balance with upcoming recurring payments', async () => {
    await add({ amount: 50000, categoryId: category['Food & Dining'].id, date: '2026-09-20' });
    await asha.post('/api/recurring').send({
      template: { type: 'expense', amount: 64900, walletId: wallets.bank.id, merchant: 'Netflix' },
      frequency: 'monthly',
      startDate: '2026-09-28',
    });

    const res = await asha.get('/api/ai/forecast');

    expect(res.status).toBe(200);
    const f = res.body.data;
    expect(f).toMatchObject({
      month: '2026-09',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      today: '2026-09-24',
      balance: 5500000 - 50000,
      daysLeft: 6,
      upcomingExpense: 64900,
      upcomingIncome: 0,
    });
    expect(f.upcoming).toEqual([{ date: '2026-09-28', type: 'expense', amount: 64900 }]);
    expect(f.predictedEnd).toBe(f.balance - f.averageDaily * 6 - 64900);
    expect(f.series).toHaveLength(30);
    expect(f.series.at(-1).predicted).toBe(f.predictedEnd);
  });
});

describe('GET /api/ai/health-score', () => {
  it('scores five parts from real data', async () => {
    await addHistory();
    const res = await asha.get('/api/ai/health-score');

    expect(res.status).toBe(200);
    const h = res.body.data;
    expect(h.monthsUsed).toBe(3);
    expect(h.parts.map((p) => p.key)).toEqual([
      'savings',
      'budgets',
      'stability',
      'goals',
      'buffer',
    ]);
    // Saved (60k − 24k) / 60k = 60% → full marks for saving.
    expect(h.parts[0]).toMatchObject({ score: 35, value: 60 });
    expect(h.score).toBe(h.parts.reduce((total, p) => total + p.score, 0));
  });
});

describe('subscriptions', () => {
  it('finds a monthly charge, and remembers when the user cancels it', async () => {
    for (const date of ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05']) {
      await add({ amount: 64900, merchant: 'NETFLIX.COM', date });
    }
    const res = await asha.get('/api/ai/subscriptions');

    expect(res.body.data.totals).toEqual({ yearly: 778800, monthly: 64900, count: 1 });
    const [netflix] = res.body.data.subscriptions;
    expect(netflix).toMatchObject({
      merchantKey: 'netflix',
      period: 'monthly',
      avgAmount: 64900,
      nextExpectedAt: '2026-10-05',
      status: 'active',
      late: false,
    });

    const patched = await asha
      .patch(`/api/ai/subscriptions/${netflix.id}`)
      .send({ status: 'cancelled' });
    expect(patched.body.data.subscription.status).toBe('cancelled');

    const again = await asha.get('/api/ai/subscriptions');
    expect(again.body.data.subscriptions[0].status).toBe('cancelled');
    expect(again.body.data.totals.count).toBe(0);

    const ravi = await signUp(app, { name: 'Ravi' });
    const theirs = await ravi
      .patch(`/api/ai/subscriptions/${netflix.id}`)
      .send({ status: 'active' });
    expect(theirs.status).toBe(404);
  });
});

describe('GET /api/ai/budget-suggestions', () => {
  it('suggests budgets from the last three months', async () => {
    await addHistory();
    const res = await asha.get('/api/ai/budget-suggestions');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      basedOn: ['2026-06', '2026-07', '2026-08'],
      forMonth: '2026-09',
      income: 6000000,
      suggestedTotal: 2400000,
      projectedSavingsRate: 60,
    });
    expect(res.body.data.suggestions).toEqual([
      expect.objectContaining({ categoryId: category.Rent.id, suggested: 1500000, kind: 'need' }),
      expect.objectContaining({ categoryId: category['Food & Dining'].id, suggested: 900000 }),
    ]);
  });
});

describe('POST /api/ai/what-if', () => {
  it('shows how cutting a category moves savings and goal dates', async () => {
    await addHistory();
    await asha.post('/api/goals').send({ name: 'Bike', targetAmount: 15000000 });

    const res = await asha
      .post('/api/ai/what-if')
      .send({ changes: [{ categoryId: category['Food & Dining'].id, changePercent: -50 }] });

    expect(res.status).toBe(200);
    const w = res.body.data;
    expect(w.before.savings).toBe(3600000);
    expect(w.after.savings).toBe(4050000);
    // ₹1.5L at ₹36k/month = 5 months; at ₹40.5k = 4 months.
    expect(w.goals[0]).toMatchObject({
      name: 'Bike',
      before: { months: 5 },
      after: { months: 4 },
      monthsSooner: 1,
    });
  });

  it('checks the changes', async () => {
    const res = await asha
      .post('/api/ai/what-if')
      .send({ changes: [{ categoryId: 'x', changePercent: -150 }] });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/ai/anomalies', () => {
  it('flags an unusual week and a double charge', async () => {
    // ₹1,000 of food every week for 8 weeks (Mondays from 27 Jul), then ₹6,000 this week.
    for (let week = 0; week < 8; week += 1) {
      await add({
        amount: 100000 + week * 1000,
        categoryId: category['Food & Dining'].id,
        date: addDays('2026-07-27', week * 7),
      });
    }
    await add({ amount: 600000, categoryId: category['Food & Dining'].id, date: '2026-09-22' });
    // Charged twice by Swiggy the same evening.
    await add({ amount: 45000, merchant: 'Swiggy', date: '2026-09-23T19:00:00+05:30' });
    await add({ amount: 45000, merchant: 'Swiggy', date: '2026-09-23T19:04:00+05:30' });

    const res = await asha.get('/api/ai/anomalies');

    expect(res.body.data.weekStart).toBe('2026-09-21');
    expect(res.body.data.categories).toEqual([
      expect.objectContaining({ categoryId: category['Food & Dining'].id, thisWeek: 600000 }),
    ]);
    expect(res.body.data.duplicates).toEqual([
      expect.objectContaining({ merchantKey: 'swiggy', amount: 45000, hoursApart: 0.1 }),
    ]);
  });
});
