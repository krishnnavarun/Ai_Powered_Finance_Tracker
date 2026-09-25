import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { saveInsights } from '../../src/services/insight.service.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';

let app;
let asha;
let wallets;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ({ wallets } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});

const tip = (key, fields = {}) => ({
  type: 'tip',
  severity: 'info',
  title: `Tip ${key}`,
  message: 'Do this',
  reason: 'Because',
  dedupeKey: key,
  ...fields,
});

describe('insights API', () => {
  it('lists newest first with the unseen count, and hides dismissed ones', async () => {
    await saveInsights(asha.user.id, [tip('a')]);
    vi.setSystemTime(new Date('2026-09-24T06:40:00Z')); // (the login token lasts 15 min)
    await saveInsights(asha.user.id, [tip('b'), tip('c')]);

    const res = await asha.get('/api/insights');
    expect(res.body.data.unseen).toBe(3);
    expect(res.body.data.insights.map((i) => i.dedupeKey)).toEqual(['c', 'b', 'a']);

    const [first] = res.body.data.insights;
    await asha.patch(`/api/insights/${first.id}`).send({ dismissed: true });
    await asha.post('/api/insights/seen').send({ ids: res.body.data.insights.map((i) => i.id) });

    const after = await asha.get('/api/insights');
    expect(after.body.data.unseen).toBe(0);
    expect(after.body.data.insights).toHaveLength(2);
    const all = await asha.get('/api/insights?includeDismissed=true');
    expect(all.body.data.insights).toHaveLength(3);
  });

  it('checks for new insights on demand', async () => {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 5000000,
      walletId: wallets.bank.id,
      date: '2026-09-23',
    });
    const res = await asha.post('/api/insights/refresh');
    expect(res.status).toBe(200);
    expect(res.body.data.created).toBeGreaterThanOrEqual(1);
    expect(res.body.data.insights.map((i) => i.type)).toContain('forecast');

    // Asking again finds nothing new.
    expect((await asha.post('/api/insights/refresh')).body.data.created).toBe(0);
  });

  it('keeps insights private', async () => {
    await saveInsights(asha.user.id, [tip('a')]);
    const [mine] = (await asha.get('/api/insights')).body.data.insights;
    const ravi = await signUp(app, { name: 'Ravi' });

    expect((await ravi.get('/api/insights')).body.data).toEqual({ insights: [], unseen: 0 });
    expect((await ravi.patch(`/api/insights/${mine.id}`).send({ dismissed: true })).status).toBe(
      404,
    );
    expect((await ravi.post('/api/insights/seen').send({ ids: [mine.id] })).body.data.updated).toBe(
      0,
    );
    expect((await asha.get('/api/insights')).body.data.unseen).toBe(1);
  });
});
