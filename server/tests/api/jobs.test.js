import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { budgetAlertsForUser, runBudgetAlerts } from '../../src/jobs/alerts.job.js';
import { refreshInsights, runNightlyInsights } from '../../src/jobs/insights.job.js';
import { runDueRecurring } from '../../src/jobs/recurring.job.js';
import { startScheduler } from '../../src/jobs/scheduler.js';
import { Insight } from '../../src/models/Insight.js';
import { RecurringRule } from '../../src/models/RecurringRule.js';
import { Transaction } from '../../src/models/Transaction.js';
import { addDays } from '../../src/utils/dates.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { balanceOf, expectBalancesConsistent, setUpMoney } from '../helpers/fixtures.js';

let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // Thursday 24 Sep 2026 in India
  asha = await signUp(createApp(), { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const at = (iso) => new Date(iso);
// Oldest first (_id breaks ties: the clock is frozen in these tests).
const insightsOf = () =>
  Insight.find({ userId: asha.user.id }).sort({ createdAt: 1, _id: 1 }).lean();

async function addRule(body) {
  const res = await asha.post('/api/recurring').send(body);
  expect(res.status).toBe(201);
  return res.body.data.rule;
}

describe('recurring runner', () => {
  const rent = () => ({
    template: {
      type: 'expense',
      amount: 1500000,
      walletId: wallets.bank.id,
      categoryId: category.Rent.id,
      merchant: 'Landlord',
    },
    frequency: 'monthly',
    startDate: '2026-10-01',
  });

  it('adds the payment when its day comes, once', async () => {
    const rule = await addRule(rent());
    // 30 Sep: not yet.
    expect((await runDueRecurring(at('2026-09-30T12:00:00Z'))).created).toBe(0);

    // 1 Oct, 00:10 in India.
    const result = await runDueRecurring(at('2026-09-30T18:40:00Z'));
    expect(result).toEqual({ rules: 1, created: 1, failed: 0 });

    const [txn] = await Transaction.find({ userId: asha.user.id }).lean();
    expect(txn).toMatchObject({
      type: 'expense',
      amount: 1500000,
      merchant: 'Landlord',
      source: 'recurring',
    });
    expect(String(txn.recurringId)).toBe(rule.id);
    expect(txn.date.toISOString()).toBe('2026-09-30T18:30:00.000Z'); // 1 Oct in India
    expect(await balanceOf(wallets.bank)).toBe(5000000 - 1500000);

    const stored = await RecurringRule.findById(rule.id).lean();
    expect(stored).toMatchObject({ lastRunDate: '2026-10-01', nextDate: '2026-11-01' });

    // Running again the same day adds nothing more.
    expect((await runDueRecurring(at('2026-09-30T19:00:00Z'))).created).toBe(0);
    await expectBalancesConsistent(asha.user.id);
  });

  it('catches up on missed dates and never learns from its own rows', async () => {
    await addRule({ ...rent(), frequency: 'weekly', startDate: '2026-09-25' });
    // The worker was off for three weeks.
    const result = await runDueRecurring(at('2026-10-16T12:00:00Z'));
    expect(result.created).toBe(4); // 25 Sep, 2, 9 and 16 Oct
    const dates = (await Transaction.find({ userId: asha.user.id }).sort({ date: 1 }).lean()).map(
      (t) => t.date.toISOString().slice(0, 10),
    );
    expect(dates).toEqual(['2026-09-24', '2026-10-01', '2026-10-08', '2026-10-15']);
    await expectBalancesConsistent(asha.user.id);
  });

  it('two runners at once add each payment only once', async () => {
    await addRule(rent());
    const moment = at('2026-10-01T06:00:00Z');
    const [a, b] = await Promise.all([runDueRecurring(moment), runDueRecurring(moment)]);
    expect(a.created + b.created).toBe(1);
    expect(await Transaction.countDocuments({ userId: asha.user.id })).toBe(1);
  });

  it('pauses a rule whose wallet was archived, and says so', async () => {
    const rule = await addRule(rent());
    await asha.patch(`/api/wallets/${wallets.bank.id}`).send({ isArchived: true });

    const result = await runDueRecurring(at('2026-10-01T06:00:00Z'));

    expect(result).toMatchObject({ created: 0, failed: 1 });
    expect((await RecurringRule.findById(rule.id)).active).toBe(false);
    const [insight] = await insightsOf();
    expect(insight).toMatchObject({ type: 'tip', severity: 'warn', title: 'Landlord was paused' });
  });
});

describe('budget alerts', () => {
  async function spend(amount) {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount,
      walletId: wallets.bank.id,
      categoryId: category['Food & Dining'].id,
      date: '2026-09-20',
    });
  }

  it('warns at 80% and again at 100%, each once', async () => {
    await asha
      .post('/api/budgets')
      .send({ categoryId: category['Food & Dining'].id, month: '2026-09', limit: 1000000 });

    await spend(700000);
    expect(await budgetAlertsForUser(asha.user.id)).toBe(0);

    await spend(150000); // 85%
    expect(await budgetAlertsForUser(asha.user.id)).toBe(1);
    expect(await budgetAlertsForUser(asha.user.id)).toBe(0); // not twice

    await spend(200000); // 105%
    await runBudgetAlerts();

    const insights = await insightsOf();
    expect(insights.map((i) => [i.title, i.severity])).toEqual([
      ['85% of your Food & Dining budget used', 'warn'],
      ['Food & Dining budget is used up', 'critical'],
    ]);
    expect(insights[1].message).toBe(
      'You’ve spent ₹10,500 of ₹10,000 with 7 days left this month.',
    );
    expect(insights[1].reason).toContain('You asked to be told at 100%.');
  });

  it('jumping straight past 100% sends one "used up" message', async () => {
    await asha.post('/api/budgets').send({ categoryId: null, month: '2026-09', limit: 100000 });
    await spend(150000);
    await runBudgetAlerts();
    expect((await insightsOf()).map((i) => i.title)).toEqual(['Overall budget is used up']);
  });

  it('respects the user’s setting', async () => {
    await asha.post('/api/budgets').send({ categoryId: null, month: '2026-09', limit: 100000 });
    await asha.patch('/api/users/me/settings').send({ budgetAlerts: false });
    await spend(150000);
    expect(await runBudgetAlerts()).toEqual({ users: 0, sent: 0 });
  });
});

describe('insights', () => {
  it('turns anomalies, double charges and subscriptions into explained insights, once', async () => {
    const add = (fields) =>
      asha
        .post('/api/transactions')
        .send({ type: 'expense', walletId: wallets.bank.id, ...fields });
    for (let week = 0; week < 8; week += 1) {
      await add({
        amount: 100000 + week * 1000,
        categoryId: category['Food & Dining'].id,
        date: addDays('2026-07-27', week * 7),
      });
    }
    await add({ amount: 600000, categoryId: category['Food & Dining'].id, date: '2026-09-22' });
    await add({ amount: 45000, merchant: 'Swiggy', date: '2026-09-23T19:00:00+05:30' });
    await add({ amount: 45000, merchant: 'Swiggy', date: '2026-09-23T19:04:00+05:30' });
    for (const date of ['2026-06-26', '2026-07-26', '2026-08-26']) {
      await add({ amount: 64900, merchant: 'Netflix', date });
    }

    expect(await refreshInsights(asha.user.id)).toBe(3);
    const insights = await insightsOf();
    const byType = Object.fromEntries(insights.map((i) => [i.type, i]));

    expect(byType.anomaly.title).toBe('Unusual spending on Food & Dining');
    expect(byType.anomaly.message).toMatch(
      /^You spent ₹6,000 on Food & Dining this week, about 5\.8× your usual ₹1,035\.$/,
    );
    expect(byType.anomaly.reason).toContain('we point out anything above 2');
    expect(byType.duplicate.title).toBe('Charged twice at Swiggy?');
    expect(byType.subscription).toMatchObject({
      title: 'Netflix renews soon',
      message: 'About ₹649 will be charged around 2026-09-26.',
    });

    // The next night finds the same things and adds nothing.
    expect(await runNightlyInsights()).toEqual({ users: 1, created: 0 });
  });

  it('warns when money may run out this month', async () => {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 5000000,
      walletId: wallets.bank.id,
      date: '2026-09-23',
    });
    await refreshInsights(asha.user.id);
    const [forecast] = await Insight.find({ userId: asha.user.id, type: 'forecast' }).lean();
    expect(forecast).toMatchObject({
      severity: 'critical',
      title: 'You may run out of money this month',
    });
    expect(forecast.reason).toMatch(/now − .* a day × 6 days/);
  });
});

describe('scheduler without Redis', () => {
  it('runs interval jobs at start and on their interval, and daily jobs at their hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T20:25:00Z')); // 01:55 in India
    const calls = [];
    const jobs = {
      quick: { every: 60_000, run: async () => calls.push('quick') },
      nightly: {
        pattern: '0 2 * * *',
        tz: 'Asia/Kolkata',
        hour: 2,
        run: async () => calls.push('nightly'),
      },
    };
    const stop = await startScheduler({ redisUrl: undefined, jobs });

    expect(calls).toEqual(['quick']);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toEqual(['quick', 'quick']);
    await vi.advanceTimersByTimeAsync(9 * 60_000); // 02:05 India: nightly runs once
    expect(calls.filter((c) => c === 'nightly')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(50 * 60_000); // still 02:xx: not again
    expect(calls.filter((c) => c === 'nightly')).toHaveLength(1);

    await stop();
    const count = calls.length;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(calls).toHaveLength(count);
  });
});
