import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { Budget } from '../../src/models/Budget.js';
import { User } from '../../src/models/User.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';

let asha;
let wallets;
let category;
let coffee;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  // "Today" is 24 Sep 2026, noon in India. Only Date is faked; timers run normally.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  asha = await signUp(createApp(), { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
  coffee = (
    await asha
      .post('/api/categories')
      .send({ name: 'Coffee', type: 'expense', parentId: category['Food & Dining'].id })
  ).body.data.category;
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const spend = (amount, categoryId, date, extra = {}) =>
  asha.post('/api/transactions').send({
    type: 'expense',
    amount,
    walletId: wallets.bank.id,
    categoryId,
    date,
    ...extra,
  });
const createBudget = (body) => asha.post('/api/budgets').send(body);
const status = (month = '2026-09') => asha.get(`/api/budgets/status?month=${month}`);
const byCategory = (res, categoryId) =>
  res.body.data.budgets.find((b) => b.budget.categoryId === categoryId);

describe('creating budgets', () => {
  it('creates a category budget and an overall budget for a month', async () => {
    const food = await createBudget({
      categoryId: category['Food & Dining'].id,
      month: '2026-09',
      limit: 500000,
    });
    const overall = await createBudget({ month: '2026-09', limit: 3000000, rollover: true });

    expect(food.status).toBe(201);
    expect(food.body.data.budget).toMatchObject({
      categoryId: category['Food & Dining'].id,
      month: '2026-09',
      limit: 500000,
      alertLevels: [80, 100],
      rollover: false,
    });
    expect(overall.body.data.budget).toMatchObject({ categoryId: null, rollover: true });
  });

  it('allows only one budget per category (and one overall) per month', async () => {
    await createBudget({ categoryId: category.Groceries.id, month: '2026-09', limit: 100 });
    await createBudget({ month: '2026-09', limit: 100 });

    const again = await createBudget({
      categoryId: category.Groceries.id,
      month: '2026-09',
      limit: 200,
    });
    const overallAgain = await createBudget({ month: '2026-09', limit: 200 });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('BUDGET_EXISTS');
    expect(overallAgain.body.error.message).toBe(
      'You already have an overall budget for that month',
    );

    // A different month is fine.
    expect(
      (await createBudget({ categoryId: category.Groceries.id, month: '2026-10', limit: 200 }))
        .status,
    ).toBe(201);
  });

  it('only accepts expense categories', async () => {
    const res = await createBudget({
      categoryId: category.Salary.id,
      month: '2026-09',
      limit: 100,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({
      path: 'categoryId',
      message: '"Salary" is an income category',
    });
  });

  it.each([
    [{ month: '2026-13', limit: 100 }, 'month'],
    [{ month: 'Sept', limit: 100 }, 'month'],
    [{ month: '2026-09', limit: 0 }, 'limit'],
    [{ month: '2026-09', limit: 10.5 }, 'limit'],
    [{ month: '2026-09', limit: 100, alertLevels: [0] }, 'alertLevels.0'],
  ])('rejects %j', async (body, field) => {
    const res = await createBudget(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it('lists this month’s budgets by default', async () => {
    await createBudget({ month: '2026-09', limit: 100 });
    await createBudget({ month: '2026-08', limit: 100 });
    const res = await asha.get('/api/budgets');
    expect(res.body.data.month).toBe('2026-09');
    expect(res.body.data.budgets).toHaveLength(1);
  });
});

describe('budget status', () => {
  beforeEach(async () => {
    await createBudget({
      categoryId: category['Food & Dining'].id,
      month: '2026-09',
      limit: 500000,
    });
    await createBudget({ categoryId: category.Groceries.id, month: '2026-09', limit: 200000 });
    await createBudget({ month: '2026-09', limit: 600000 });

    await spend(300000, category['Food & Dining'].id, '2026-09-05');
    await spend(50000, coffee.id, '2026-09-10'); // a sub-category counts for its parent
    await spend(250000, category.Groceries.id, '2026-09-12');
    // Not counted: other months, income, transfers.
    await spend(999900, category.Groceries.id, '2026-08-31T23:59:00+05:30');
    await spend(999900, category.Groceries.id, '2026-10-01T00:00:00+05:30');
    await asha.post('/api/transactions').send({
      type: 'income',
      amount: 5000000,
      walletId: wallets.bank.id,
      categoryId: category.Salary.id,
      date: '2026-09-01',
    });
    await asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      amount: 100000,
      date: '2026-09-02',
    });
  });

  it('shows spent, left, percent and a daily allowance for each budget', async () => {
    const res = await status();

    expect(res.body.data).toMatchObject({
      month: '2026-09',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      daysLeft: 7, // 24th to 30th
      totalSpent: 600000,
    });
    expect(byCategory(res, category['Food & Dining'].id)).toMatchObject({
      spent: 350000,
      remaining: 150000,
      percent: 70,
      status: 'ok',
      dailyAllowance: 21428, // ₹1,500 over 7 days, rounded down
    });
    expect(byCategory(res, category.Groceries.id)).toMatchObject({
      spent: 250000,
      remaining: -50000,
      status: 'over',
      dailyAllowance: 0,
    });
    expect(byCategory(res, null)).toMatchObject({ spent: 600000, percent: 100, status: 'over' });
  });

  it('uses the user’s salary-day month', async () => {
    await User.updateOne({ _id: asha.user.id }, { monthStartDay: 25 });

    const res = await status('2026-08'); // 25 Aug → 24 Sep
    expect(res.body.data).toMatchObject({
      fromDate: '2026-08-25',
      toDate: '2026-09-24',
      daysLeft: 1,
    });
    // The 31 Aug spending now falls in this month too.
    expect(res.body.data.totalSpent).toBe(999900 + 600000);
  });

  it('carries last month’s unspent money forward when rollover is on', async () => {
    await createBudget({ categoryId: category.Transport.id, month: '2026-08', limit: 400000 });
    await spend(100000, category.Transport.id, '2026-08-20');
    const september = await createBudget({
      categoryId: category.Transport.id,
      month: '2026-09',
      limit: 400000,
      rollover: true,
    });

    const transport = byCategory(await status(), category.Transport.id);
    expect(transport).toMatchObject({ rolloverAmount: 300000, effectiveLimit: 700000 });

    await asha.patch(`/api/budgets/${september.body.data.budget.id}`).send({ rollover: false });
    expect(byCategory(await status(), category.Transport.id).rolloverAmount).toBe(0);
  });

  it('reports a past month as finished', async () => {
    expect((await status('2026-08')).body.data.daysLeft).toBe(0);
  });
});

describe('editing budgets', () => {
  it('changes the limit and resets sent alerts', async () => {
    const { budget } = (await createBudget({ month: '2026-09', limit: 100000 })).body.data;
    await Budget.updateOne({ _id: budget.id }, { alertsSent: [80] });

    const res = await asha
      .patch(`/api/budgets/${budget.id}`)
      .send({ limit: 150000, alertLevels: [100, 50, 50] });

    expect(res.body.data.budget).toMatchObject({
      limit: 150000,
      alertLevels: [50, 100],
      alertsSent: [],
    });
  });

  it('does not allow moving a budget to another month', async () => {
    const { budget } = (await createBudget({ month: '2026-09', limit: 100000 })).body.data;
    const res = await asha.patch(`/api/budgets/${budget.id}`).send({ month: '2026-10' });
    expect(res.status).toBe(400);
  });

  it('deletes a budget, and protects a category that still has one', async () => {
    const { budget } = (
      await createBudget({ categoryId: coffee.id, month: '2026-09', limit: 100000 })
    ).body.data;

    const blocked = await asha.delete(`/api/categories/${coffee.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/has a budget/);

    expect((await asha.delete(`/api/budgets/${budget.id}`)).status).toBe(204);
    expect((await asha.delete(`/api/categories/${coffee.id}`)).status).toBe(204);
  });
});
