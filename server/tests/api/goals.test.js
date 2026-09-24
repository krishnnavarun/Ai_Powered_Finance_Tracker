import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';

let asha;
let wallets;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // 24 Sep 2026 in India
  asha = await signUp(createApp(), { name: 'Asha' });
  ({ wallets } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const createGoal = (body) => asha.post('/api/goals').send(body);
const contribute = (id, body) => asha.post(`/api/goals/${id}/contribute`).send(body);
const phone = { name: 'New phone', targetAmount: 6000000, deadline: '2026-12-31' };

describe('goals', () => {
  it('creates a goal with its progress and the monthly saving needed', async () => {
    const res = await createGoal({
      ...phone,
      savedAmount: 1500000,
      linkedWalletId: wallets.bank.id,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.goal).toMatchObject({
      name: 'New phone',
      targetAmount: 6000000,
      savedAmount: 1500000,
      deadline: '2026-12-31',
      linkedWalletId: wallets.bank.id,
      status: 'active',
      progress: { percent: 25, remaining: 4500000, monthsLeft: 4, requiredPerMonth: 1125000 },
    });
  });

  it('starts as done when the money is already there', async () => {
    const res = await createGoal({ ...phone, savedAmount: 6000000 });
    expect(res.body.data.goal.status).toBe('done');
  });

  it('lists active goals first', async () => {
    await createGoal({ ...phone, name: 'Finished', savedAmount: 6000000 });
    await createGoal({ ...phone, name: 'Trip' });
    const names = (await asha.get('/api/goals')).body.data.goals.map((g) => g.name);
    expect(names).toEqual(['Trip', 'Finished']);
  });

  it.each([
    [{ ...phone, targetAmount: 0 }, 'targetAmount'],
    [{ ...phone, name: '' }, 'name'],
    [{ ...phone, deadline: '31-12-2026' }, 'deadline'],
    [{ ...phone, savedAmount: -1 }, 'savedAmount'],
  ])('rejects %j', async (body, field) => {
    const res = await createGoal(body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toContain(field);
  });

  it('can be paused, edited and deleted', async () => {
    const { goal } = (await createGoal(phone)).body.data;

    const paused = await asha
      .patch(`/api/goals/${goal.id}`)
      .send({ status: 'paused', targetAmount: 5000000 });
    expect(paused.body.data.goal).toMatchObject({
      status: 'paused',
      targetAmount: 5000000,
      progress: { requiredPerMonth: null },
    });

    expect((await asha.delete(`/api/goals/${goal.id}`)).status).toBe(204);
    expect((await asha.get('/api/goals')).body.data.goals).toEqual([]);
  });

  it('is unlinked, not blocked, when its wallet is deleted', async () => {
    const { goal } = (await createGoal({ ...phone, linkedWalletId: wallets.card.id })).body.data;
    expect((await asha.delete(`/api/wallets/${wallets.card.id}`)).status).toBe(204);
    const [stored] = (await asha.get('/api/goals')).body.data.goals;
    expect(stored).toMatchObject({ id: goal.id, linkedWalletId: null });
  });
});

describe('adding and taking out money', () => {
  let goal;
  beforeEach(async () => {
    goal = (await createGoal({ ...phone, savedAmount: 1000000 })).body.data.goal;
  });

  it('adds money and records it with today’s date', async () => {
    const res = await contribute(goal.id, { amount: 250000, note: 'Diwali bonus' });

    expect(res.body.data.goal.savedAmount).toBe(1250000);
    expect(res.body.data.goal.contributions).toEqual([
      expect.objectContaining({ amount: 250000, date: '2026-09-24', note: 'Diwali bonus' }),
    ]);
    expect(res.body.data.goal.justCompleted).toBe(false);
  });

  it('marks the goal done the moment it is reached', async () => {
    const res = await contribute(goal.id, { amount: 5000000 });
    expect(res.body.data.goal).toMatchObject({
      status: 'done',
      justCompleted: true,
      savedAmount: 6000000,
    });
  });

  it('takes money out, and reopens a finished goal', async () => {
    await contribute(goal.id, { amount: 5000000 });
    const res = await contribute(goal.id, { amount: -500000, note: 'Needed for rent' });
    expect(res.body.data.goal).toMatchObject({ savedAmount: 5500000, status: 'active' });
  });

  it('won’t take out more than is saved', async () => {
    const res = await contribute(goal.id, { amount: -1000001 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'NOT_ENOUGH_SAVED',
      details: { savedAmount: 1000000 },
    });
  });

  it('rejects zero', async () => {
    expect((await contribute(goal.id, { amount: 0 })).status).toBe(400);
  });

  it('counts every contribution when many arrive at once', async () => {
    await Promise.all(Array.from({ length: 10 }, () => contribute(goal.id, { amount: 1000 })));
    const [stored] = (await asha.get('/api/goals')).body.data.goals;
    expect(stored.savedAmount).toBe(1000000 + 10 * 1000);
    expect(stored.contributions).toHaveLength(10);
  });

  it('never goes below zero, even with parallel withdrawals', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => contribute(goal.id, { amount: -300000 })),
    );
    const accepted = results.filter((res) => res.status === 200).length;
    expect(accepted).toBe(3); // 3 × ₹3,000 fit in ₹10,000; the rest are refused
    const [stored] = (await asha.get('/api/goals')).body.data.goals;
    expect(stored.savedAmount).toBe(1000000 - 3 * 300000);
  });
});
