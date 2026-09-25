import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { lastWeek, runWeeklyDigest, sendDigestForUser } from '../../src/jobs/digest.job.js';
import { Insight } from '../../src/models/Insight.js';
import { sendEmail } from '../../src/services/email.service.js';
import { saveInsights } from '../../src/services/insight.service.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeLLM, useNoLLM } from '../helpers/fakeLLM.js';
import { setUpMoney } from '../helpers/fixtures.js';

let app;
let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T04:00:00Z')); // Monday 28 Sep, 9:30 AM in India
  app = createApp();
  asha = await signUp(app, { name: 'Asha Rao' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});
resetLLMAfterEach();

const spend = (amount, date, name = 'Food & Dining') =>
  asha.post('/api/transactions').send({
    type: 'expense',
    amount,
    walletId: wallets.bank.id,
    categoryId: category[name].id,
    date,
  });

describe('notifications', () => {
  it('rings the bell for new warnings (not plain tips), and marks them read', async () => {
    const warning = {
      type: 'budget',
      severity: 'warn',
      title: 'Food budget 85% used',
      message: 'm',
      dedupeKey: 'a',
    };
    await saveInsights(asha.user.id, [
      warning,
      { type: 'tip', severity: 'info', title: 'Just a tip', message: 'm', dedupeKey: 'b' },
    ]);
    // The same warning again adds nothing.
    await saveInsights(asha.user.id, [warning]);

    const res = await asha.get('/api/notifications');
    expect(res.body.data.unread).toBe(1);
    const [bell] = res.body.data.notifications;
    expect(bell).toMatchObject({
      kind: 'budget',
      title: 'Food budget 85% used',
      link: '/insights',
      read: false,
    });

    await asha.patch(`/api/notifications/${bell.id}/read`);
    expect((await asha.get('/api/notifications')).body.data.unread).toBe(0);
  });

  it('marks all as read, and stays private', async () => {
    await saveInsights(asha.user.id, [
      { type: 'anomaly', severity: 'warn', title: 'One', message: 'm', dedupeKey: '1' },
      { type: 'forecast', severity: 'critical', title: 'Two', message: 'm', dedupeKey: '2' },
    ]);
    const ravi = await signUp(app, { name: 'Ravi' });
    const [first] = (await asha.get('/api/notifications')).body.data.notifications;

    expect((await ravi.get('/api/notifications')).body.data).toEqual({
      notifications: [],
      unread: 0,
    });
    expect((await ravi.patch(`/api/notifications/${first.id}/read`)).status).toBe(404);
    expect((await ravi.post('/api/notifications/read-all')).body.data.updated).toBe(0);

    expect((await asha.post('/api/notifications/read-all')).body.data.updated).toBe(2);
  });
});

describe('weekly digest', () => {
  it('covers last Monday to Sunday', () => {
    expect(lastWeek(new Date('2026-09-28T04:00:00Z'), 'Asia/Kolkata')).toEqual({
      from: '2026-09-21',
      to: '2026-09-27',
    });
    // Sunday night in India is still the week before.
    expect(lastWeek(new Date('2026-09-27T17:00:00Z'), 'Asia/Kolkata')).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
    });
  });

  it('sums up the week in the app, once, with an AI note', async () => {
    await spend(100000, '2026-09-15'); // the week before
    await spend(60000, '2026-09-22');
    await spend(1500000, '2026-09-23', 'Rent');
    const llm = useFakeLLM({ note: 'A steady week, mostly rent.' });

    expect(await sendDigestForUser(asha.user.id)).toEqual({ created: true, emailed: false });
    expect(await sendDigestForUser(asha.user.id)).toEqual({ created: false });

    const [digest] = await Insight.find({
      userId: asha.user.id,
      dedupeKey: 'digest:2026-09-21',
    }).lean();
    expect(digest.title).toBe('Your week: ₹15,600 spent');
    expect(digest.message).toBe(
      'A steady week, mostly rent. Money out: ₹15,600 (+1460% vs the week before). Money in: ₹0. Most spent on: Rent ₹15,000, Food & Dining ₹600.',
    );
    // The AI only saw the week's totals.
    expect(llm.calls[0].user).toContain('Money out: ₹15,600');

    const bell = (await asha.get('/api/notifications')).body.data.notifications;
    expect(bell).toEqual([
      expect.objectContaining({
        kind: 'digest',
        title: 'Your week: ₹15,600 spent',
        link: '/reports',
      }),
    ]);
  });

  it('uses fixed words when AI is off, and skips people with nothing recent', async () => {
    useNoLLM();
    await spend(60000, '2026-09-22');
    await signUp(app, { name: 'Quiet' });
    expect(await runWeeklyDigest()).toEqual({ users: 1, created: 1, emailed: 0 });
    const [digest] = await Insight.find({ dedupeKey: 'digest:2026-09-21' }).lean();
    expect(digest.message).toMatch(/^Here’s how your week went\. Money out: ₹600/);
  });
});

describe('sendEmail', () => {
  it('does nothing without Resend set up', async () => {
    expect(await sendEmail({ to: 'a@b.c', subject: 's', text: 't' })).toEqual({
      sent: false,
      reason: 'not-configured',
    });
  });

  it('posts to Resend when set up', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, init });
      return new Response('{}', { status: 200 });
    };
    const result = await sendEmail(
      { to: 'asha@example.com', subject: 'Your week', text: 'hi', html: '<p>hi</p>' },
      { fetchImpl, config: { RESEND_API_KEY: 're_test', EMAIL_FROM: 'Paisa Pal <d@x.in>' } },
    );
    expect(result).toEqual({ sent: true });
    expect(calls[0].url).toBe('https://api.resend.com/emails');
    expect(calls[0].init.headers.authorization).toBe('Bearer re_test');
    expect(JSON.parse(calls[0].init.body)).toMatchObject({
      from: 'Paisa Pal <d@x.in>',
      to: ['asha@example.com'],
    });
  });
});
