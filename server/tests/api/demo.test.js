import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { removeOldDemoAccounts } from '../../src/jobs/cleanup.job.js';
import { Transaction } from '../../src/models/Transaction.js';
import { User } from '../../src/models/User.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useNoLLM } from '../helpers/fakeLLM.js';
import { expectBalancesConsistent } from '../helpers/fixtures.js';

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // Thursday in India
  useNoLLM();
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});
resetLLMAfterEach();

describe('POST /api/auth/demo', () => {
  it('creates a logged-in sandbox with six months of realistic data', async () => {
    const app = createApp();
    const res = await request(app).post('/api/auth/demo');

    expect(res.status).toBe(201);
    const { user, accessToken } = res.body.data;
    expect(user).toMatchObject({ name: 'Demo User', onboardingDone: true });
    expect(user.email).toMatch(/^demo-[0-9a-f]{12}@demo\.paisa-pal\.invalid$/);
    expect(res.headers['set-cookie'][0]).toMatch(/^pp_rt=/);
    const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);

    const count = await Transaction.countDocuments({ userId: user.id });
    expect(count).toBeGreaterThan(300);
    const first = await Transaction.findOne({ userId: user.id }).sort({ date: 1 }).lean();
    expect(first.date.toISOString()).toBe('2026-03-31T18:30:00.000Z'); // 1 April in India
    await expectBalancesConsistent(user.id);

    const summary = await auth(request(app).get('/api/reports/summary'));
    expect(summary.body.data.income).toBeGreaterThanOrEqual(6500000);

    const budgets = await auth(request(app).get('/api/budgets/status'));
    expect(budgets.body.data.budgets).toHaveLength(4);
    const goals = await auth(request(app).get('/api/goals'));
    expect(goals.body.data.goals.map((g) => g.name)).toEqual(['Emergency fund', 'Goa trip']);

    // The planted unusual week and double charge are already waiting as insights.
    const insights = await auth(request(app).get('/api/insights'));
    const types = insights.body.data.insights.map((i) => i.type);
    expect(types).toEqual(expect.arrayContaining(['anomaly', 'duplicate']));
    const categories = (await auth(request(app).get('/api/categories'))).body.data.categories;
    const food = categories.find((c) => c.name === 'Food & Dining');
    const whatIf = await auth(
      request(app)
        .post('/api/ai/what-if')
        .send({ changes: [{ categoryId: food.id, changePercent: -20 }] }),
    );
    expect(whatIf.body).toMatchObject({ success: true });
    expect(whatIf.body.data.savingsChange).toBeGreaterThan(0);
    const subscriptions = await auth(request(app).get('/api/ai/subscriptions'));
    expect(subscriptions.body.data.subscriptions.map((s) => s.displayName)).toEqual(
      expect.arrayContaining(['Netflix', 'Jio', 'Spotify']),
    );
  }, 60_000);

  it('gives every visitor their own account', async () => {
    const app = createApp();
    const a = await request(app).post('/api/auth/demo');
    const b = await request(app).post('/api/auth/demo');
    expect(a.body.data.user.id).not.toBe(b.body.data.user.id);
  }, 60_000);
});

describe('demo cleanup', () => {
  it('removes demo accounts after a day, and never real ones', async () => {
    const app = createApp();
    const demo = (await request(app).post('/api/auth/demo')).body.data.user;
    const real = await signUp(app, { name: 'Real' });

    expect(await removeOldDemoAccounts(new Date('2026-09-24T12:00:00Z'))).toEqual({ removed: 0 });
    expect(await removeOldDemoAccounts(new Date('2026-09-25T07:00:00Z'))).toEqual({ removed: 1 });

    expect(await User.exists({ _id: demo.id })).toBeNull();
    expect(await Transaction.countDocuments({ userId: demo.id })).toBe(0);
    expect(await User.exists({ _id: real.user.id })).not.toBeNull();
  }, 60_000);
});
