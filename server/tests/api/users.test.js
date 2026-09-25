import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';

let asha;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  asha = await signUp(createApp(), { name: 'Asha' });
});
afterEach(clearTestDB);

describe('PATCH /api/users/me', () => {
  it('starts new users with onboarding not done', () => {
    expect(asha.user).toMatchObject({
      onboardingDone: false,
      monthStartDay: 1,
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    });
  });

  it('updates the profile and finishes onboarding', async () => {
    const res = await asha
      .patch('/api/users/me')
      .send({ name: ' Asha K ', monthStartDay: 25, onboardingDone: true });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({
      name: 'Asha K',
      monthStartDay: 25,
      onboardingDone: true,
    });
    expect(res.body.data.user).not.toHaveProperty('passwordHash');

    const me = await asha.get('/api/auth/me');
    expect(me.body.data.user).toMatchObject({ monthStartDay: 25, onboardingDone: true });
  });

  it('accepts real time zones and rejects unknown ones', async () => {
    const ok = await asha.patch('/api/users/me').send({ timezone: 'Europe/London' });
    expect(ok.body.data.user.timezone).toBe('Europe/London');

    const bad = await asha.patch('/api/users/me').send({ timezone: 'Mars/Olympus' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    [{ monthStartDay: 29 }],
    [{ monthStartDay: 0 }],
    [{ currency: 'USD' }],
    [{ name: '   ' }],
    [{}],
    // Fields that aren't part of the profile are dropped, leaving nothing to update.
    [{ email: 'new@example.com' }],
  ])('rejects %j', async (body) => {
    const res = await asha.patch('/api/users/me').send(body);
    expect(res.status).toBe(400);
  });

  it('needs a login', async () => {
    const res = await asha.patch('/api/users/me').set('Authorization', '').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/users/me/settings', () => {
  it('changes one setting and keeps the others', async () => {
    const res = await asha.patch('/api/users/me/settings').send({ aiEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.data.user.settings).toEqual({
      aiEnabled: false,
      digestEmail: true,
      budgetAlerts: true,
      theme: 'system',
    });

    const again = await asha.patch('/api/users/me/settings').send({ theme: 'dark' });
    expect(again.body.data.user.settings).toMatchObject({ aiEnabled: false, theme: 'dark' });
  });

  it('rejects unknown values', async () => {
    const res = await asha.patch('/api/users/me/settings').send({ theme: 'pink' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/users/me/export', () => {
  it('downloads everything in the account, without secrets', async () => {
    const wallet = (await asha.post('/api/wallets').send({ name: 'Cash', type: 'cash' })).body.data
      .wallet;
    await asha
      .post('/api/transactions')
      .send({ type: 'expense', amount: 5000, walletId: wallet.id, date: '2026-09-01' });

    const res = await asha.get('/api/users/me/export');

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="paisa-pal-export-/);
    expect(res.body.user).toMatchObject({ name: 'Asha' });
    expect(res.body.wallets).toHaveLength(1);
    expect(res.body.transactions).toEqual([expect.objectContaining({ amount: 5000 })]);
    expect(res.body.categories.length).toBeGreaterThan(10);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|receiptKey|tokenHash/);
  });
});

describe('DELETE /api/users/me', () => {
  it('needs the right password', async () => {
    const res = await asha.delete('/api/users/me').send({ password: 'wrong-one' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('WRONG_PASSWORD');
    expect((await asha.get('/api/auth/me')).status).toBe(200);
  });

  it('removes the account and all its data', async () => {
    const wallet = (await asha.post('/api/wallets').send({ name: 'Cash', type: 'cash' })).body.data
      .wallet;
    await asha
      .post('/api/transactions')
      .send({ type: 'expense', amount: 5000, walletId: wallet.id, date: '2026-09-01' });

    const res = await asha.delete('/api/users/me').send({ password: 'password123' });

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/^pp_rt=;/);
    expect((await asha.get('/api/auth/me')).status).toBe(401);
    const { Transaction } = await import('../../src/models/Transaction.js');
    const { Category } = await import('../../src/models/Category.js');
    expect(await Transaction.countDocuments({ userId: asha.user.id })).toBe(0);
    expect(await Category.countDocuments({ userId: asha.user.id })).toBe(0);
  });
});
