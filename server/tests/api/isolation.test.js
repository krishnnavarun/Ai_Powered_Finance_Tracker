import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { Category } from '../../src/models/Category.js';
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
