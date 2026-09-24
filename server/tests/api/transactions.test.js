import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { balanceOf, expectBalancesConsistent, setUpMoney } from '../helpers/fixtures.js';

let app;
let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  await expectBalancesConsistent(asha.user.id);
  await clearTestDB();
});

const create = (body) => asha.post('/api/transactions').send(body);
const expense = (overrides = {}) =>
  create({
    type: 'expense',
    amount: 25000, // ₹250
    walletId: wallets.cash.id,
    categoryId: category['Food & Dining'].id,
    merchant: 'Swiggy',
    date: '2026-09-20',
    ...overrides,
  });
const update = (id, body) => asha.patch(`/api/transactions/${id}`).send(body);

describe('POST /api/transactions', () => {
  it('records an expense and takes it out of the wallet', async () => {
    const res = await expense({ note: 'Biryani with Rahul', tags: ['Friends', 'friends', 'food'] });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction).toMatchObject({
      type: 'expense',
      amount: 25000,
      walletId: wallets.cash.id,
      toWalletId: null,
      categoryId: category['Food & Dining'].id,
      merchant: 'Swiggy',
      merchantKey: 'swiggy',
      note: 'Biryani with Rahul',
      tags: ['friends', 'food'],
      source: 'manual',
    });
    expect(await balanceOf(wallets.cash)).toBe(500000 - 25000);
  });

  it('adds income to the wallet', async () => {
    await create({
      type: 'income',
      amount: 4500000,
      walletId: wallets.bank.id,
      categoryId: category.Salary.id,
      date: '2026-09-01',
    });
    expect(await balanceOf(wallets.bank)).toBe(5000000 + 4500000);
  });

  it('stores a plain date as the start of that day in India', async () => {
    const res = await expense({ date: '2026-09-24' });
    expect(res.body.data.transaction.date).toBe('2026-09-23T18:30:00.000Z');
  });

  it('keeps an exact time when one is given', async () => {
    const res = await expense({ date: '2026-09-24T20:15:00+05:30' });
    expect(res.body.data.transaction.date).toBe('2026-09-24T14:45:00.000Z');
  });

  it('allows a transaction without a category', async () => {
    const res = await expense({ categoryId: undefined });
    expect(res.status).toBe(201);
    expect(res.body.data.transaction.categoryId).toBeNull();
  });

  it.each([
    [{ amount: 0 }, 'amount'],
    [{ amount: -500 }, 'amount'],
    [{ amount: 99.5 }, 'amount'],
    [{ date: '24/09/2026' }, 'date'],
    [{ date: '1999-12-31' }, 'date'],
    [{ date: '2030-01-01' }, 'date'],
    [{ walletId: 'nope' }, 'walletId'],
    [{ source: 'recurring' }, 'source'],
    [{ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, 'tags'],
  ])('rejects invalid input %j', async (overrides, field) => {
    const res = await expense(overrides);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it('rejects a category of the wrong type', async () => {
    const res = await expense({ categoryId: category.Salary.id });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([
      { path: 'categoryId', message: '"Salary" is an income category' },
    ]);
  });

  it('rejects an unknown wallet or category with 404', async () => {
    expect((await expense({ walletId: '665f1c2e8b3a4d0012345678' })).status).toBe(404);
    expect((await expense({ categoryId: '665f1c2e8b3a4d0012345678' })).status).toBe(404);
  });

  it('refuses new transactions on an archived wallet', async () => {
    await asha.patch(`/api/wallets/${wallets.cash.id}`).send({ isArchived: true });
    const res = await expense();
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WALLET_ARCHIVED');
  });

  it('accepts AI-captured transactions with a confidence score', async () => {
    const res = await expense({ source: 'sms', aiConfidence: 0.82 });
    expect(res.body.data.transaction).toMatchObject({ source: 'sms', aiConfidence: 0.82 });
  });
});

describe('transfers', () => {
  const transfer = (body) =>
    asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      amount: 200000,
      date: '2026-09-20',
      ...body,
    });

  it('moves money between two wallets in one transaction', async () => {
    const res = await transfer({ note: 'ATM withdrawal' });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction).toMatchObject({
      type: 'transfer',
      walletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      categoryId: null,
      note: 'ATM withdrawal',
    });
    expect(await balanceOf(wallets.bank)).toBe(5000000 - 200000);
    expect(await balanceOf(wallets.cash)).toBe(500000 + 200000);
  });

  it('can pay off a credit card', async () => {
    await transfer({ toWalletId: wallets.card.id, amount: 1500000 });
    expect(await balanceOf(wallets.card)).toBe(1500000);
  });

  it('needs two different wallets', async () => {
    const res = await transfer({ toWalletId: wallets.bank.id });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toEqual({
      path: 'toWalletId',
      message: 'Choose two different wallets for a transfer',
    });
  });

  it('can also be created through POST /transactions, but not with a category', async () => {
    const res = await create({
      type: 'transfer',
      amount: 1000,
      walletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      categoryId: category['Food & Dining'].id,
      date: '2026-09-20',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('categoryId');
  });

  it('needs a destination wallet', async () => {
    const res = await create({
      type: 'transfer',
      amount: 1000,
      walletId: wallets.bank.id,
      date: '2026-09-20',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('toWalletId');
  });
});

describe('PATCH /api/transactions/:id', () => {
  let txn;
  beforeEach(async () => {
    txn = (await expense()).body.data.transaction; // ₹250 from cash
  });

  it('adjusts the balance by the difference when the amount changes', async () => {
    await update(txn.id, { amount: 40000 });
    expect(await balanceOf(wallets.cash)).toBe(500000 - 40000);
  });

  it('moves the money when the wallet changes', async () => {
    await update(txn.id, { walletId: wallets.bank.id });
    expect(await balanceOf(wallets.cash)).toBe(500000);
    expect(await balanceOf(wallets.bank)).toBe(5000000 - 25000);
  });

  it('flips the effect when an expense becomes income', async () => {
    const res = await update(txn.id, { type: 'income', categoryId: category.Refund.id });
    expect(res.body.data.transaction.type).toBe('income');
    expect(await balanceOf(wallets.cash)).toBe(500000 + 25000);
  });

  it('refuses a category that no longer fits the new type', async () => {
    const res = await update(txn.id, { type: 'income' });
    expect(res.status).toBe(400);
    expect(await balanceOf(wallets.cash)).toBe(500000 - 25000); // unchanged
  });

  it('turns an expense into a transfer and drops the category', async () => {
    const res = await update(txn.id, { type: 'transfer', toWalletId: wallets.bank.id });
    expect(res.body.data.transaction).toMatchObject({
      type: 'transfer',
      toWalletId: wallets.bank.id,
      categoryId: null,
    });
    expect(await balanceOf(wallets.bank)).toBe(5000000 + 25000);
  });

  it('turns a transfer back into an expense and drops the destination', async () => {
    await update(txn.id, { type: 'transfer', toWalletId: wallets.bank.id });
    const res = await update(txn.id, { type: 'expense' });
    expect(res.body.data.transaction.toWalletId).toBeNull();
    expect(await balanceOf(wallets.bank)).toBe(5000000);
    expect(await balanceOf(wallets.cash)).toBe(500000 - 25000);
  });

  it('updates the merchant key with the merchant', async () => {
    const res = await update(txn.id, { merchant: 'ZOMATO LTD' });
    expect(res.body.data.transaction.merchantKey).toBe('zomato');
  });

  it('still allows editing a transaction whose wallet was archived later', async () => {
    await asha.patch(`/api/wallets/${wallets.cash.id}`).send({ isArchived: true });
    const res = await update(txn.id, { note: 'fixed typo' });
    expect(res.status).toBe(200);
  });

  it('does not allow changing the source', async () => {
    const res = await update(txn.id, { source: 'sms' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/transactions/:id', () => {
  it('gives the money back to the wallet', async () => {
    const { transaction } = (await expense()).body.data;
    expect((await asha.delete(`/api/transactions/${transaction.id}`)).status).toBe(204);
    expect(await balanceOf(wallets.cash)).toBe(500000);
    expect((await asha.get(`/api/transactions/${transaction.id}`)).status).toBe(404);
  });

  it('protects wallets and categories that have transactions', async () => {
    await expense();
    const wallet = await asha.delete(`/api/wallets/${wallets.cash.id}`);
    expect(wallet.status).toBe(409);
    expect(wallet.body.error.code).toBe('WALLET_IN_USE');

    const pets = (await asha.post('/api/categories').send({ name: 'Pets', type: 'expense' })).body
      .data.category;
    await expense({ categoryId: pets.id });
    const cat = await asha.delete(`/api/categories/${pets.id}`);
    expect(cat.status).toBe(409);
    expect(cat.body.error.code).toBe('CATEGORY_IN_USE');
  });

  it('also protects the destination wallet of a transfer', async () => {
    await asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.card.id,
      amount: 100,
      date: '2026-09-20',
    });
    expect((await asha.delete(`/api/wallets/${wallets.card.id}`)).status).toBe(409);
  });
});

describe('GET /api/transactions', () => {
  const list = (query = '') => asha.get(`/api/transactions${query}`);
  const merchants = (res) => res.body.data.transactions.map((t) => t.merchant);

  beforeEach(async () => {
    const coffee = (
      await asha
        .post('/api/categories')
        .send({ name: 'Coffee', type: 'expense', parentId: category['Food & Dining'].id })
    ).body.data.category;

    await expense({ merchant: 'Swiggy', amount: 25000, date: '2026-09-01', tags: ['friends'] });
    await expense({
      merchant: 'Blue Tokai',
      amount: 30000,
      categoryId: coffee.id,
      date: '2026-09-10',
    });
    await expense({
      merchant: 'BigBasket',
      amount: 180000,
      walletId: wallets.bank.id,
      categoryId: category.Groceries.id,
      date: '2026-09-15',
      note: 'monthly (bulk) groceries',
    });
    await create({
      type: 'income',
      merchant: 'Acme Corp',
      amount: 4500000,
      walletId: wallets.bank.id,
      categoryId: category.Salary.id,
      date: '2026-09-01',
    });
    await asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      amount: 200000,
      date: '2026-09-20',
    });
  });

  it('lists newest first with totals for everything that matches', async () => {
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.body.data.transactions).toHaveLength(5);
    expect(res.body.data.transactions[0].type).toBe('transfer'); // 20 Sep
    expect(res.body.data.totals).toEqual({ income: 4500000, expense: 235000, transfer: 200000 });
  });

  it('paginates, with totals covering all pages', async () => {
    const res = await list('?limit=2&page=2');
    expect(res.body.data.transactions).toHaveLength(2);
    expect(res.body.data.pagination).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
    expect(res.body.data.totals.expense).toBe(235000);
  });

  it('filters by date range using the user’s time zone', async () => {
    // 11:30 pm on the 24th in India is still the 24th…
    await expense({ merchant: 'Late snack', date: '2026-09-24T23:30:00+05:30' });
    // …and 12:10 am on the 25th is not.
    await expense({ merchant: 'Midnight snack', date: '2026-09-25T00:10:00+05:30' });

    const res = await list('?from=2026-09-24&to=2026-09-24');
    expect(merchants(res)).toEqual(['Late snack']);
  });

  it('filters by type', async () => {
    expect(merchants(await list('?type=income'))).toEqual(['Acme Corp']);
  });

  it('filters by wallet, including transfers into it', async () => {
    const res = await list(`?walletId=${wallets.cash.id}`);
    expect(res.body.data.transactions.map((t) => t.type).sort()).toEqual([
      'expense',
      'expense',
      'transfer',
    ]);
  });

  it('includes sub-categories when filtering by a parent category', async () => {
    const res = await list(`?categoryId=${category['Food & Dining'].id}&sort=date`);
    expect(merchants(res)).toEqual(['Swiggy', 'Blue Tokai']);
  });

  it('filters by tag and amount range', async () => {
    expect(merchants(await list('?tag=friends'))).toEqual(['Swiggy']);
    expect(
      merchants(await list('?type=expense&minAmount=26000&maxAmount=200000&sort=amount')),
    ).toEqual(['Blue Tokai', 'BigBasket']);
  });

  it('searches merchant and note, ignoring case, and treats symbols literally', async () => {
    expect(merchants(await list('?q=basket'))).toEqual(['BigBasket']);
    expect(merchants(await list('?q=MONTHLY'))).toEqual(['BigBasket']);
    expect(merchants(await list(`?q=${encodeURIComponent('(bulk)')}`))).toEqual(['BigBasket']);
    expect((await list(`?q=${encodeURIComponent('.*')}`)).body.data.transactions).toEqual([]);
  });

  it('sorts by amount', async () => {
    const res = await list('?type=expense&sort=-amount');
    expect(merchants(res)).toEqual(['BigBasket', 'Blue Tokai', 'Swiggy']);
  });

  it.each([
    ['?from=2026-09-30&to=2026-09-01', 'to'],
    ['?limit=500', 'limit'],
    ['?minAmount=abc', 'minAmount'],
    ['?type=refund', 'type'],
  ])('rejects invalid filters %s', async (query, field) => {
    const res = await list(query);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/transactions')).status).toBe(401);
  });
});

describe('POST /api/transactions/bulk', () => {
  let ids;
  beforeEach(async () => {
    ids = [];
    for (const amount of [10000, 20000, 30000]) {
      ids.push((await expense({ amount })).body.data.transaction.id);
    }
    ids.push(
      (
        await create({
          type: 'income',
          amount: 5000,
          walletId: wallets.cash.id,
          date: '2026-09-20',
        })
      ).body.data.transaction.id,
    );
  });

  it('deletes several transactions and restores balances', async () => {
    const res = await asha
      .post('/api/transactions/bulk')
      .send({ action: 'delete', ids: [...ids, '665f1c2e8b3a4d0012345678'] });

    expect(res.body.data).toEqual({ deleted: 4, notFound: 1 });
    expect(await balanceOf(wallets.cash)).toBe(500000);
  });

  it('re-categorizes only the transactions that match the category type', async () => {
    const res = await asha
      .post('/api/transactions/bulk')
      .send({ action: 'categorize', ids, categoryId: category.Groceries.id });

    expect(res.body.data).toEqual({ updated: 3, skipped: 1, notFound: 0 });
    const groceries = await asha.get(`/api/transactions?categoryId=${category.Groceries.id}`);
    expect(groceries.body.data.transactions).toHaveLength(3);
  });

  it('validates the request', async () => {
    const noIds = await asha.post('/api/transactions/bulk').send({ action: 'delete', ids: [] });
    expect(noIds.status).toBe(400);
    const noCategory = await asha
      .post('/api/transactions/bulk')
      .send({ action: 'categorize', ids });
    expect(noCategory.status).toBe(400);
    const unknown = await asha.post('/api/transactions/bulk').send({ action: 'archive', ids });
    expect(unknown.status).toBe(400);
  });
});
