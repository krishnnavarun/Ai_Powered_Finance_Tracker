import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';

let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // 24 Sep 2026 in India
  asha = await signUp(createApp(), { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const rent = () => ({
  template: {
    type: 'expense',
    amount: 1500000,
    walletId: wallets.bank.id,
    categoryId: category.Rent.id,
    merchant: 'Landlord',
  },
  frequency: 'monthly',
  startDate: '2026-01-31',
});
const create = (body) => asha.post('/api/recurring').send(body);

describe('recurring payments', () => {
  it('schedules the next run from today, keeping month-end dates', async () => {
    const res = await create(rent());

    expect(res.status).toBe(201);
    expect(res.body.data.rule).toMatchObject({
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-01-31',
      nextDate: '2026-09-30',
      nextRun: '2026-09-29T18:30:00.000Z', // midnight in India
      active: true,
      upcoming: ['2026-09-30', '2026-10-31', '2026-11-30'],
      template: {
        type: 'expense',
        amount: 1500000,
        walletId: wallets.bank.id,
        categoryId: category.Rent.id,
        merchant: 'Landlord',
        note: '',
        toWalletId: null,
      },
    });
  });

  it('waits for a start date in the future', async () => {
    const res = await create({
      ...rent(),
      startDate: '2026-10-05',
      frequency: 'weekly',
      interval: 2,
    });
    expect(res.body.data.rule).toMatchObject({
      nextDate: '2026-10-05',
      upcoming: ['2026-10-05', '2026-10-19', '2026-11-02'],
    });
  });

  it('stops once the end date has passed', async () => {
    const res = await create({ ...rent(), endDate: '2026-08-31' });
    expect(res.body.data.rule).toMatchObject({ nextDate: null, nextRun: null, upcoming: [] });
  });

  it('handles salary as income and a monthly SIP as a transfer', async () => {
    const salary = await create({
      template: {
        type: 'income',
        amount: 4500000,
        walletId: wallets.bank.id,
        categoryId: category.Salary.id,
      },
      frequency: 'monthly',
      startDate: '2026-01-30',
    });
    const sip = await create({
      template: {
        type: 'transfer',
        amount: 500000,
        walletId: wallets.bank.id,
        toWalletId: wallets.cash.id,
      },
      frequency: 'monthly',
      startDate: '2026-01-05',
    });
    expect(salary.body.data.rule.nextDate).toBe('2026-09-30');
    expect(sip.body.data.rule).toMatchObject({
      nextDate: '2026-10-05',
      template: { categoryId: null },
    });
  });

  it('checks the payment like a real transaction', async () => {
    const wrongType = await create({
      ...rent(),
      template: { ...rent().template, categoryId: category.Salary.id },
    });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.error.details[0].message).toBe('"Salary" is an income category');

    const sameWallet = await create({
      ...rent(),
      template: {
        type: 'transfer',
        amount: 100,
        walletId: wallets.bank.id,
        toWalletId: wallets.bank.id,
      },
    });
    expect(sameWallet.status).toBe(400);

    const badDates = await create({ ...rent(), endDate: '2025-12-31' });
    expect(badDates.status).toBe(400);
    expect(badDates.body.error.details[0].path).toBe('endDate');
  });

  it('can be paused and resumed', async () => {
    const { rule } = (await create(rent())).body.data;

    const paused = await asha.patch(`/api/recurring/${rule.id}`).send({ active: false });
    expect(paused.body.data.rule).toMatchObject({ active: false, nextDate: null, upcoming: [] });

    const resumed = await asha.patch(`/api/recurring/${rule.id}`).send({ active: true });
    expect(resumed.body.data.rule.nextDate).toBe('2026-09-30');
  });

  it('re-plans when the schedule changes, but not for an amount change', async () => {
    const { rule } = (await create(rent())).body.data;

    const newAmount = await asha
      .patch(`/api/recurring/${rule.id}`)
      .send({ template: { ...rent().template, amount: 1600000 } });
    expect(newAmount.body.data.rule).toMatchObject({
      nextDate: '2026-09-30',
      template: { amount: 1600000 },
    });

    const weekly = await asha.patch(`/api/recurring/${rule.id}`).send({ frequency: 'weekly' });
    expect(weekly.body.data.rule.nextDate).toBe('2026-09-26'); // Saturdays, like 31 Jan
  });

  it('lists and deletes rules, and protects the wallet a rule uses', async () => {
    const { rule } = (await create(rent())).body.data;
    expect((await asha.get('/api/recurring')).body.data.rules).toHaveLength(1);

    const blocked = await asha.delete(`/api/wallets/${wallets.bank.id}`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(/recurring payment/);

    expect((await asha.delete(`/api/recurring/${rule.id}`)).status).toBe(204);
    expect((await asha.get('/api/recurring')).body.data.rules).toEqual([]);
  });
});
