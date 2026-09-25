import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Category } from '../../src/models/Category.js';
import { Transaction } from '../../src/models/Transaction.js';
import { Wallet } from '../../src/models/Wallet.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';

// Proves that one user can never see or change another user's data.
// Every new resource type must add its cases here.

let app;
let asha; // owner
let ravi; // someone else
let ashaWallet;
let ashaCategory;

beforeAll(startTestDB);
afterAll(stopTestDB);

beforeEach(async () => {
  // Fresh app per test = fresh sign-up rate-limit counters.
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ravi = await signUp(app, { name: 'Ravi' });
  ashaWallet = (
    await asha
      .post('/api/wallets')
      .send({ name: 'Asha HDFC', type: 'bank', openingBalance: 500000 })
  ).body.data.wallet;
  ashaCategory = (await asha.post('/api/categories').send({ name: 'Asha Pets', type: 'expense' }))
    .body.data.category;
});
afterEach(clearTestDB);

describe('wallets are private', () => {
  it("do not appear in another user's list", async () => {
    await ravi.post('/api/wallets').send({ name: 'Ravi Cash', type: 'cash' });
    const res = await ravi.get('/api/wallets?includeArchived=true');
    expect(res.body.data.wallets.map((w) => w.name)).toEqual(['Ravi Cash']);
    expect(res.body.data.wallets[0].userId).toBe(ravi.user.id);
  });

  it.each([
    ['get', (id) => ravi.get(`/api/wallets/${id}`)],
    [
      'update',
      (id) => ravi.patch(`/api/wallets/${id}`).send({ name: 'Hacked', openingBalance: 0 }),
    ],
    ['delete', (id) => ravi.delete(`/api/wallets/${id}`)],
  ])("can't be %s by another user (looks like it doesn't exist)", async (_action, attempt) => {
    const res = await attempt(ashaWallet.id);
    expect(res.status).toBe(404);
    expect(res.body.error).toEqual({ code: 'NOT_FOUND', message: 'Wallet not found' });

    const stored = await Wallet.findById(ashaWallet.id);
    expect(stored).toMatchObject({ name: 'Asha HDFC', balance: 500000 });
  });

  it('can share a name across users', async () => {
    const res = await ravi.post('/api/wallets').send({ name: 'Asha HDFC', type: 'bank' });
    expect(res.status).toBe(201);
  });
});

describe('categories are private', () => {
  it("do not appear in another user's list", async () => {
    const res = await ravi.get('/api/categories?includeArchived=true');
    const names = res.body.data.categories.map((c) => c.name);
    expect(names).not.toContain('Asha Pets');
    expect(res.body.data.categories.every((c) => c.userId === ravi.user.id)).toBe(true);
  });

  it('each user has their own copy of the defaults', async () => {
    const ashaFood = (await asha.get('/api/categories')).body.data.categories[0];
    await asha.patch(`/api/categories/${ashaFood.id}`).send({ name: 'Eating Out' });

    const raviFood = (await ravi.get('/api/categories')).body.data.categories[0];
    expect(raviFood.name).toBe('Food & Dining');
    expect(raviFood.id).not.toBe(ashaFood.id);
  });

  it.each([
    ['update', (id) => ravi.patch(`/api/categories/${id}`).send({ name: 'Hacked' })],
    ['delete', (id) => ravi.delete(`/api/categories/${id}`)],
  ])("can't be %s by another user", async (_action, attempt) => {
    const res = await attempt(ashaCategory.id);
    expect(res.status).toBe(404);
    expect(await Category.findById(ashaCategory.id)).toMatchObject({ name: 'Asha Pets' });
  });

  it("can't be used as a parent by another user", async () => {
    const res = await ravi
      .post('/api/categories')
      .send({ name: 'Sneaky', type: 'expense', parentId: ashaCategory.id });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toBe('Parent category not found');
  });
});

describe('transactions are private', () => {
  let ashaTxn;
  let raviWallet;

  beforeEach(async () => {
    ashaTxn = (
      await asha.post('/api/transactions').send({
        type: 'expense',
        amount: 25000,
        walletId: ashaWallet.id,
        categoryId: ashaCategory.id,
        merchant: 'Asha secret shop',
        date: '2026-09-20',
      })
    ).body.data.transaction;
    raviWallet = (await ravi.post('/api/wallets').send({ name: 'Ravi Cash', type: 'cash' })).body
      .data.wallet;
  });

  it("do not appear in another user's list, search or totals", async () => {
    const res = await ravi.get('/api/transactions?q=secret');
    expect(res.body.data.transactions).toEqual([]);
    expect(res.body.data.totals).toEqual({ income: 0, expense: 0, transfer: 0 });

    const byWallet = await ravi.get(`/api/transactions?walletId=${ashaWallet.id}`);
    expect(byWallet.body.data.transactions).toEqual([]);
  });

  it.each([
    ['read', (id) => ravi.get(`/api/transactions/${id}`)],
    ['edited', (id) => ravi.patch(`/api/transactions/${id}`).send({ amount: 1 })],
    ['deleted', (id) => ravi.delete(`/api/transactions/${id}`)],
  ])("can't be %s by another user", async (_action, attempt) => {
    const res = await attempt(ashaTxn.id);
    expect(res.status).toBe(404);
    expect(await Transaction.findById(ashaTxn.id)).toMatchObject({ amount: 25000 });
  });

  it('are skipped by bulk actions from another user', async () => {
    const del = await ravi
      .post('/api/transactions/bulk')
      .send({ action: 'delete', ids: [ashaTxn.id] });
    expect(del.body.data).toEqual({ deleted: 0, notFound: 1 });
    expect(await Transaction.exists({ _id: ashaTxn.id })).toBeTruthy();
  });

  it("can't be created on another user's wallet or with their category", async () => {
    const onHerWallet = await ravi.post('/api/transactions').send({
      type: 'expense',
      amount: 100,
      walletId: ashaWallet.id,
      date: '2026-09-20',
    });
    expect(onHerWallet.status).toBe(404);

    const withHerCategory = await ravi.post('/api/transactions').send({
      type: 'expense',
      amount: 100,
      walletId: raviWallet.id,
      categoryId: ashaCategory.id,
      date: '2026-09-20',
    });
    expect(withHerCategory.status).toBe(404);
  });

  it("can't move money into or out of another user's wallet", async () => {
    const into = await ravi.post('/api/wallets/transfer').send({
      fromWalletId: raviWallet.id,
      toWalletId: ashaWallet.id,
      amount: 100,
      date: '2026-09-20',
    });
    const outOf = await ravi.post('/api/wallets/transfer').send({
      fromWalletId: ashaWallet.id,
      toWalletId: raviWallet.id,
      amount: 100,
      date: '2026-09-20',
    });
    expect([into.status, outOf.status]).toEqual([404, 404]);
    expect((await Wallet.findById(ashaWallet.id)).balance).toBe(500000 - 25000);
  });

  it("can't point their own transaction at another user's wallet", async () => {
    const own = (
      await ravi.post('/api/transactions').send({
        type: 'expense',
        amount: 100,
        walletId: raviWallet.id,
        date: '2026-09-20',
      })
    ).body.data.transaction;

    const res = await ravi.patch(`/api/transactions/${own.id}`).send({ walletId: ashaWallet.id });
    expect(res.status).toBe(404);
    expect((await Wallet.findById(ashaWallet.id)).balance).toBe(500000 - 25000);
  });
});

describe('budgets, goals and recurring payments are private', () => {
  let ashaBudget;
  let ashaGoal;
  let ashaRule;

  beforeEach(async () => {
    ashaBudget = (
      await asha
        .post('/api/budgets')
        .send({ categoryId: ashaCategory.id, month: '2026-09', limit: 100000 })
    ).body.data.budget;
    ashaGoal = (await asha.post('/api/goals').send({ name: 'Asha trip', targetAmount: 900000 }))
      .body.data.goal;
    ashaRule = (
      await asha.post('/api/recurring').send({
        template: { type: 'expense', amount: 5000, walletId: ashaWallet.id },
        frequency: 'monthly',
        startDate: '2026-09-01',
      })
    ).body.data.rule;
  });

  it("don't appear in another user's lists", async () => {
    expect((await ravi.get('/api/budgets?month=2026-09')).body.data.budgets).toEqual([]);
    expect((await ravi.get('/api/budgets/status?month=2026-09')).body.data.budgets).toEqual([]);
    expect((await ravi.get('/api/goals')).body.data.goals).toEqual([]);
    expect((await ravi.get('/api/recurring')).body.data.rules).toEqual([]);
  });

  it.each([
    ['budget', () => ravi.patch(`/api/budgets/${ashaBudget.id}`).send({ limit: 1 })],
    ['budget', () => ravi.delete(`/api/budgets/${ashaBudget.id}`)],
    ['goal', () => ravi.patch(`/api/goals/${ashaGoal.id}`).send({ name: 'Mine now' })],
    ['goal', () => ravi.delete(`/api/goals/${ashaGoal.id}`)],
    ['goal', () => ravi.post(`/api/goals/${ashaGoal.id}/contribute`).send({ amount: 100 })],
    [
      'recurring payment',
      () => ravi.patch(`/api/recurring/${ashaRule.id}`).send({ active: false }),
    ],
    ['recurring payment', () => ravi.delete(`/api/recurring/${ashaRule.id}`)],
  ])("another user can't change a %s", async (_kind, attempt) => {
    expect((await attempt()).status).toBe(404);
  });

  it("can't budget, save or schedule with another user's category or wallet", async () => {
    const budget = await ravi
      .post('/api/budgets')
      .send({ categoryId: ashaCategory.id, month: '2026-09', limit: 1 });
    const goal = await ravi
      .post('/api/goals')
      .send({ name: 'x', targetAmount: 1, linkedWalletId: ashaWallet.id });
    const rule = await ravi.post('/api/recurring').send({
      template: { type: 'expense', amount: 1, walletId: ashaWallet.id },
      frequency: 'daily',
      startDate: '2026-09-01',
    });
    expect([budget.status, goal.status, rule.status]).toEqual([404, 404, 404]);
  });

  it("other users' spending never counts toward a budget", async () => {
    const raviWallet = (await ravi.post('/api/wallets').send({ name: 'R', type: 'cash' })).body.data
      .wallet;
    const raviSpend = await ravi.post('/api/transactions').send({
      type: 'expense',
      amount: 99999,
      walletId: raviWallet.id,
      date: '2026-09-10',
    });
    expect(raviSpend.status).toBe(201); // Ravi's spending really exists…

    const status = await asha.get('/api/budgets/status?month=2026-09');
    // …but Asha's month shows none of it.
    expect(status.body.data.totalSpent).toBe(0);
    expect(status.body.data.budgets[0].spent).toBe(0);
  });
});

describe('AI memory and parsing are private', () => {
  it("one user's categorizer memory never files another user's payments", async () => {
    // Asha teaches her categorizer that "Tea stall" is her "Asha Pets" category.
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 5000,
      walletId: ashaWallet.id,
      categoryId: ashaCategory.id,
      merchant: 'Tea stall',
      date: '2026-09-10',
    });

    const res = await ravi
      .post('/api/ai/categorize')
      .send({ items: [{ type: 'expense', merchant: 'Tea stall' }] });
    expect(res.body.data.suggestions[0].via).not.toBe('memory');
    expect(res.body.data.suggestions[0].categoryId).not.toBe(ashaCategory.id);
  });

  it("drafts never point at another user's wallets", async () => {
    const res = await ravi
      .post('/api/ai/parse/sms')
      .send({ text: 'Rs.250.00 debited from Asha HDFC A/c XX1234 to SWIGGY on 24-09-26' });
    expect(res.body.data.items[0].draft.walletId).toBeNull();
  });
});

describe('statement import is private', () => {
  it("another user's payments are never counted as duplicates", async () => {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 64900,
      walletId: ashaWallet.id,
      date: '2026-09-03',
    });
    const res = await ravi
      .post('/api/import/csv/preview')
      .attach(
        'statement',
        Buffer.from('Date,Description,Amount\n2026-09-03,NETFLIX,-649.00\n'),
        's.csv',
      );
    expect(res.body.data.rows[0].duplicate).toBe(false);
  });

  it("can't import into another user's wallet", async () => {
    const res = await ravi.post('/api/import/csv/commit').send({
      walletId: ashaWallet.id,
      rows: [{ date: '2026-09-03', type: 'expense', amount: 100 }],
    });
    expect(res.status).toBe(404);
    expect(await Transaction.countDocuments({ walletId: ashaWallet.id })).toBe(0);
  });
});

describe('analytics are private', () => {
  it("another user's subscriptions, forecast and anomalies stay hidden", async () => {
    for (const date of ['2026-06-05', '2026-07-05', '2026-08-05', '2026-09-05']) {
      await asha.post('/api/transactions').send({
        type: 'expense',
        amount: 64900,
        walletId: ashaWallet.id,
        merchant: 'Netflix',
        date,
      });
    }
    const mine = await asha.get('/api/ai/subscriptions');
    expect(mine.body.data.subscriptions).toHaveLength(1);

    const theirs = await ravi.get('/api/ai/subscriptions');
    expect(theirs.body.data.subscriptions).toEqual([]);
    const forecast = await ravi.get('/api/ai/forecast');
    expect(forecast.body.data.balance).toBe(0);
    const patch = await ravi
      .patch(`/api/ai/subscriptions/${mine.body.data.subscriptions[0].id}`)
      .send({ status: 'ignored' });
    expect(patch.status).toBe(404);
  });
});

describe('chats are private', () => {
  it("another user's chat can't be read, used or deleted", async () => {
    const session = (await asha.post('/api/chat/sessions').send({ title: 'Mine' })).body.data
      .session;
    expect((await ravi.get(`/api/chat/sessions/${session.id}`)).status).toBe(404);
    expect((await ravi.delete(`/api/chat/sessions/${session.id}`)).status).toBe(404);
    expect((await ravi.get('/api/chat/sessions')).body.data.sessions).toEqual([]);
  });
});
