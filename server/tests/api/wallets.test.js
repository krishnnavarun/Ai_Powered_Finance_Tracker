import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Wallet } from '../../src/models/Wallet.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';

let app;
let asha;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  // Fresh app per test = fresh sign-up rate-limit counters.
  app = createApp();
  asha = await signUp(app, { name: 'Asha Rao' });
});
afterEach(clearTestDB);

const createWallet = (body) => asha.post('/api/wallets').send(body);

describe('POST /api/wallets', () => {
  it('creates a wallet whose balance starts at the opening balance', async () => {
    const res = await createWallet({ name: 'HDFC Savings', type: 'bank', openingBalance: 2500050 });

    expect(res.status).toBe(201);
    expect(res.body.data.wallet).toMatchObject({
      name: 'HDFC Savings',
      type: 'bank',
      openingBalance: 2500050,
      balance: 2500050,
      creditLimit: null,
      isArchived: false,
      color: '#0f766e',
      icon: 'wallet',
    });
    expect(res.body.data.wallet).not.toHaveProperty('userId', undefined);
  });

  it('defaults the opening balance to zero', async () => {
    const res = await createWallet({ name: 'Cash', type: 'cash' });
    expect(res.body.data.wallet).toMatchObject({ openingBalance: 0, balance: 0 });
  });

  it('allows a negative opening balance (money owed on a card)', async () => {
    const res = await createWallet({
      name: 'ICICI Card',
      type: 'card',
      openingBalance: -1200000,
      creditLimit: 10000000,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.wallet).toMatchObject({ balance: -1200000, creditLimit: 10000000 });
  });

  it('rejects a credit limit on anything but a card', async () => {
    const res = await createWallet({ name: 'Cash', type: 'cash', creditLimit: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      path: 'creditLimit',
      message: 'Only card wallets can have a credit limit',
    });
  });

  it('only accepts whole paise', async () => {
    const res = await createWallet({ name: 'Cash', type: 'cash', openingBalance: 250.5 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('openingBalance');
  });

  it.each([
    [{ type: 'cash' }, 'name'],
    [{ name: 'Cash' }, 'type'],
    [{ name: 'Cash', type: 'crypto' }, 'type'],
    [{ name: 'Cash', type: 'cash', color: 'green' }, 'color'],
    [{ name: 'Cash', type: 'cash', icon: '<script>' }, 'icon'],
  ])('rejects invalid input %j', async (body, field) => {
    const res = await createWallet(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it('rejects a duplicate name, ignoring case', async () => {
    await createWallet({ name: 'HDFC Savings', type: 'bank' });
    const res = await createWallet({ name: 'hdfc savings', type: 'savings' });
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'DUPLICATE_NAME',
      message: 'You already have a wallet named "hdfc savings"',
    });
  });

  it('ignores a balance sent by the client', async () => {
    const res = await createWallet({
      name: 'Cash',
      type: 'cash',
      openingBalance: 100,
      balance: 999999,
    });
    expect(res.body.data.wallet.balance).toBe(100);
  });
});

describe('GET /api/wallets', () => {
  it('lists wallets in creation order and hides archived ones', async () => {
    await createWallet({ name: 'Cash', type: 'cash' });
    await createWallet({ name: 'GPay', type: 'upi' });
    const old = await createWallet({ name: 'Old Bank', type: 'bank' });
    await asha.patch(`/api/wallets/${old.body.data.wallet.id}`).send({ isArchived: true });

    const res = await asha.get('/api/wallets');
    expect(res.status).toBe(200);
    expect(res.body.data.wallets.map((w) => w.name)).toEqual(['Cash', 'GPay']);

    const all = await asha.get('/api/wallets?includeArchived=true');
    expect(all.body.data.wallets.map((w) => w.name)).toEqual(['Cash', 'GPay', 'Old Bank']);
  });

  it('gets one wallet by id', async () => {
    const { wallet } = (await createWallet({ name: 'Cash', type: 'cash' })).body.data;
    const res = await asha.get(`/api/wallets/${wallet.id}`);
    expect(res.body.data.wallet).toEqual(wallet);
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    expect((await asha.get('/api/wallets/665f1c2e8b3a4d0012345678')).status).toBe(404);
    const bad = await asha.get('/api/wallets/not-an-id');
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toContainEqual({ path: 'id', message: 'Invalid id' });
  });

  it('requires login', async () => {
    expect((await request(app).get('/api/wallets')).status).toBe(401);
  });
});

describe('PATCH /api/wallets/:id', () => {
  let walletId;
  beforeEach(async () => {
    walletId = (await createWallet({ name: 'HDFC', type: 'bank', openingBalance: 10000 })).body.data
      .wallet.id;
  });
  const update = (body) => asha.patch(`/api/wallets/${walletId}`).send(body);

  it('renames and recolours a wallet', async () => {
    const res = await update({ name: 'HDFC Salary', color: '#1d4ed8', icon: 'landmark' });
    expect(res.status).toBe(200);
    expect(res.body.data.wallet).toMatchObject({
      name: 'HDFC Salary',
      color: '#1d4ed8',
      icon: 'landmark',
    });
  });

  it('shifts the balance when the opening balance changes, keeping transaction effects', async () => {
    // Pretend ₹400 of transactions already happened: balance 500 vs opening 100.
    await Wallet.updateOne({ _id: walletId }, { balance: 50000 });

    const res = await update({ openingBalance: 20000 });

    expect(res.body.data.wallet).toMatchObject({ openingBalance: 20000, balance: 60000 });
  });

  it('never lets the balance be set directly', async () => {
    const res = await update({ balance: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].message).toBe('Nothing to update');
  });

  it('stores names literally, even ones that look like database expressions', async () => {
    const res = await update({ name: '$balance' });
    expect(res.body.data.wallet.name).toBe('$balance');
    expect(res.body.data.wallet.balance).toBe(10000);
  });

  it('clears the credit limit when a card becomes another type', async () => {
    const card = (await createWallet({ name: 'Card', type: 'card', creditLimit: 5000000 })).body
      .data.wallet;
    const res = await asha.patch(`/api/wallets/${card.id}`).send({ type: 'bank' });
    expect(res.body.data.wallet).toMatchObject({ type: 'bank', creditLimit: null });
  });

  it('rejects a credit limit on a non-card wallet', async () => {
    const res = await update({ creditLimit: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Only card wallets can have a credit limit');
  });

  it('rejects renaming to an existing name', async () => {
    await createWallet({ name: 'Cash', type: 'cash' });
    const res = await update({ name: 'CASH' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_NAME');
  });

  it('archives and restores a wallet', async () => {
    expect((await update({ isArchived: true })).body.data.wallet.isArchived).toBe(true);
    expect((await update({ isArchived: false })).body.data.wallet.isArchived).toBe(false);
  });
});

describe('DELETE /api/wallets/:id', () => {
  it('deletes a wallet', async () => {
    const { wallet } = (await createWallet({ name: 'Cash', type: 'cash' })).body.data;

    expect((await asha.delete(`/api/wallets/${wallet.id}`)).status).toBe(204);
    expect((await asha.get(`/api/wallets/${wallet.id}`)).status).toBe(404);
  });
});
