import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { User } from '../../src/models/User.js';
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
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // 24 Sep 2026 in India
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const add = (user, body) =>
  user.post('/api/transactions').send({ walletId: wallets.bank.id, ...body });
const expense = (amount, categoryId, date) =>
  add(asha, { type: 'expense', amount, categoryId, date });
const income = (amount, date) =>
  add(asha, { type: 'income', amount, categoryId: category.Salary.id, date });

describe('GET /api/reports/by-category', () => {
  beforeEach(async () => {
    const coffee = (
      await asha
        .post('/api/categories')
        .send({ name: 'Coffee', type: 'expense', parentId: category['Food & Dining'].id })
    ).body.data.category;
    await expense(300000, category['Food & Dining'].id, '2026-09-03');
    await expense(50000, coffee.id, '2026-09-05');
    await expense(400000, category.Rent.id, '2026-09-01');
    await expense(25000, null, '2026-09-10');
    await expense(999900, category.Rent.id, '2026-08-15'); // last month
    await income(5000000, '2026-09-01');
  });

  it('breaks this month’s spending down by category, biggest first', async () => {
    const res = await asha.get('/api/reports/by-category');

    expect(res.body.data).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
      type: 'expense',
      total: 775000,
    });
    expect(res.body.data.categories.map((c) => [c.name, c.total, c.count, c.percent])).toEqual([
      ['Rent', 400000, 1, 51.6],
      ['Food & Dining', 350000, 2, 45.2], // Coffee is added into its parent
      ['Uncategorized', 25000, 1, 3.2],
    ]);
    expect(res.body.data.categories[0]).toMatchObject({ icon: 'house', color: '#8b5cf6' });
  });

  it('takes a custom date range and income', async () => {
    const rent = await asha.get('/api/reports/by-category?from=2026-08-01&to=2026-08-31');
    expect(rent.body.data.categories).toEqual([
      expect.objectContaining({ name: 'Rent', total: 999900 }),
    ]);

    const earned = await asha.get('/api/reports/by-category?type=income');
    expect(earned.body.data.categories.map((c) => c.name)).toEqual(['Salary']);
  });

  it('rejects half a range or a backwards one', async () => {
    expect((await asha.get('/api/reports/by-category?from=2026-09-01')).status).toBe(400);
    expect((await asha.get('/api/reports/by-category?from=2026-09-30&to=2026-09-01')).status).toBe(
      400,
    );
  });

  it('never includes other users’ spending', async () => {
    const ravi = await signUp(app, { name: 'Ravi' });
    const res = await ravi.get('/api/reports/by-category');
    expect(res.body.data).toMatchObject({ total: 0, categories: [] });
  });
});

describe('GET /api/reports/trend', () => {
  it('gives money in, out and saved for each of the last 6 months, including empty ones', async () => {
    await income(4500000, '2026-09-01');
    await expense(1200000, category.Rent.id, '2026-09-02');
    await expense(300000, category.Groceries.id, '2026-07-10');
    await expense(999, category.Groceries.id, '2026-03-31'); // 7 months ago: left out

    const res = await asha.get('/api/reports/trend');
    const months = res.body.data.months;

    expect(months.map((m) => m.month)).toEqual([
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(months[3]).toMatchObject({ income: 0, expense: 300000, saved: -300000 });
    expect(months[5]).toMatchObject({
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      income: 4500000,
      expense: 1200000,
      saved: 3300000,
    });
    expect(months[0]).toMatchObject({ income: 0, expense: 0, saved: 0 });
  });

  it('follows the salary-day month', async () => {
    await User.updateOne({ _id: asha.user.id }, { monthStartDay: 25 });
    await expense(100000, category.Rent.id, '2026-09-24'); // still the "August" month
    await expense(200000, category.Rent.id, '2026-08-25');

    const months = (await asha.get('/api/reports/trend?months=2')).body.data.months;
    expect(months).toEqual([
      expect.objectContaining({ month: '2026-07', fromDate: '2026-07-25', expense: 0 }),
      expect.objectContaining({
        month: '2026-08',
        fromDate: '2026-08-25',
        toDate: '2026-09-24',
        expense: 300000,
      }),
    ]);
  });

  it('limits how far back it goes', async () => {
    expect((await asha.get('/api/reports/trend?months=25')).status).toBe(400);
  });
});

describe('GET /api/reports/summary', () => {
  it('gives the headline numbers for the month so far', async () => {
    await income(4000000, '2026-09-01');
    await add(asha, {
      type: 'expense',
      amount: 1200000,
      categoryId: category.Rent.id,
      merchant: 'Landlord',
      date: '2026-09-02',
    });
    await expense(120000, category.Groceries.id, '2026-09-10');
    await asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      amount: 50000,
      date: '2026-09-05',
    });

    const res = await asha.get('/api/reports/summary');

    expect(res.body.data).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
      income: 4000000,
      expense: 1320000,
      saved: 2680000,
      savingsRate: 67,
      transactionCount: 4,
      days: 24, // 1–24 Sep have passed
      avgDailySpend: 55000,
      biggestExpense: { merchant: 'Landlord', amount: 1200000, categoryId: category.Rent.id },
    });
  });

  it('has no savings rate without income, and handles an empty period', async () => {
    const res = await asha.get('/api/reports/summary?from=2026-01-01&to=2026-01-31');
    expect(res.body.data).toMatchObject({
      income: 0,
      expense: 0,
      savingsRate: null,
      days: 31,
      avgDailySpend: 0,
      biggestExpense: null,
    });
  });
});

describe('GET /api/reports/merchants and /by-wallet', () => {
  beforeEach(async () => {
    const shop = (amount, merchant, date, walletId = wallets.bank.id) =>
      add(asha, { type: 'expense', amount, merchant, walletId, date });
    await shop(25000, 'SWIGGY*Order 111', '2026-09-02');
    await shop(30000, 'Swiggy', '2026-09-05', wallets.cash.id);
    await shop(90000, 'DMart', '2026-09-06');
    await shop(1000, '', '2026-09-07'); // no merchant: left out of the merchant list
    await income(100000, '2026-09-08');
  });

  it('groups spellings of the same shop and shows the latest name', async () => {
    const res = await asha.get('/api/reports/merchants?limit=5');
    expect(res.body.data.merchants.map((m) => [m.name, m.total, m.count])).toEqual([
      ['DMart', 90000, 1],
      ['Swiggy', 55000, 2],
    ]);
  });

  it('totals money in and out per wallet, leaving transfers out', async () => {
    await asha.post('/api/wallets/transfer').send({
      fromWalletId: wallets.bank.id,
      toWalletId: wallets.cash.id,
      amount: 999999,
      date: '2026-09-09',
    });
    const res = await asha.get('/api/reports/by-wallet');
    expect(res.body.data.wallets).toEqual([
      expect.objectContaining({ name: 'HDFC', income: 100000, expense: 116000 }),
      expect.objectContaining({ name: 'Cash', income: 0, expense: 30000 }),
    ]);
  });
});

describe('GET /api/reports/export', () => {
  beforeEach(async () => {
    await add(asha, {
      type: 'expense',
      amount: 25050,
      categoryId: category['Food & Dining'].id,
      merchant: 'Café "Madras", Bengaluru',
      note: '=HYPERLINK("http://evil.example")',
      tags: ['friends'],
      date: '2026-09-03',
    });
    await income(4000000, '2026-09-01');
  });

  it('downloads a CSV that Excel opens correctly and safely', async () => {
    const res = await asha.get('/api/reports/export?format=csv').buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="paisa-pal-2026-09-01-to-2026-09-30.csv"',
    );
    expect(res.headers['cache-control']).toBe('private, no-store');

    const text = res.text;
    expect(text.charCodeAt(0)).toBe(0xfeff); // UTF-8 marker for Excel
    const lines = text.slice(1).trim().split('\r\n');
    expect(lines).toEqual([
      'Date,Type,Amount (INR),Category,Wallet,To wallet,Merchant,Note,Tags',
      '2026-09-01,income,40000.00,Salary,HDFC,,,,',
      // Quotes and commas are escaped; the formula is neutralised with a leading '.
      '2026-09-03,expense,250.50,Food & Dining,HDFC,,"Café ""Madras"", Bengaluru","\'=HYPERLINK(""http://evil.example"")",friends',
    ]);
  });

  it('downloads a PDF report', async () => {
    const res = await asha
      .get('/api/reports/export?format=pdf&from=2026-09-01&to=2026-09-30')
      .buffer(true)
      .parse((response, done) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => done(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(res.body.length).toBeGreaterThan(1500);
  });

  it('only ever exports the user’s own transactions', async () => {
    const ravi = await signUp(app, { name: 'Ravi' });
    const res = await ravi.get('/api/reports/export?format=csv');
    expect(res.text.slice(1).trim().split('\r\n')).toHaveLength(1); // header only
  });

  it('rejects unknown formats', async () => {
    expect((await asha.get('/api/reports/export?format=xlsx')).status).toBe(400);
  });
});
