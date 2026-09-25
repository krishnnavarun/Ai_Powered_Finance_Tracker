import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LLMRequestError } from '../../src/ai/errors.js';
import { createApp } from '../../src/app.js';
import { MerchantMap } from '../../src/models/MerchantMap.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeLLM, useNoLLM } from '../helpers/fakeLLM.js';
import { setUpMoney } from '../helpers/fixtures.js';
import { SKIPPED_SMS, TRANSACTION_SMS } from '../fixtures/sms.js';

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
  await asha.post('/api/wallets').send({ name: 'GPay', type: 'upi' });
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});
resetLLMAfterEach();

const parseText = (text) => asha.post('/api/ai/parse/text').send({ text });
const parseSms = (text) => asha.post('/api/ai/parse/sms').send({ text });

const aiAnswer = (overrides = {}) => ({
  type: 'expense',
  amount: 250,
  merchant: 'Biryani House',
  date: '2026-09-23',
  categoryName: 'food & dining',
  walletName: 'gpay',
  toWalletName: null,
  note: 'biryani with Rahul',
  confidence: 0.92,
  ...overrides,
});

describe('POST /api/ai/parse/text', () => {
  it('turns the AI answer into a draft with real ids and paise', async () => {
    const llm = useFakeLLM(aiAnswer());
    const res = await parseText('spent 250 on biryani with Rahul yesterday from GPay');

    expect(res.status).toBe(200);
    const gpay = (await asha.get('/api/wallets')).body.data.wallets.find((w) => w.name === 'GPay');
    expect(res.body.data).toEqual({
      usedAI: true,
      draft: {
        type: 'expense',
        amount: 25000,
        walletId: gpay.id,
        toWalletId: null,
        categoryId: category['Food & Dining'].id,
        merchant: 'Biryani House',
        note: 'biryani with Rahul',
        date: '2026-09-23',
        source: 'nl',
        aiConfidence: 0.92,
      },
    });
    // The prompt carried today's date and the user's own names.
    expect(llm.calls[0].system).toContain('2026-09-24');
    expect(llm.calls[0].system).toContain('GPay');
    expect(llm.calls[0].system).toContain('Food & Dining');
  });

  it('lowers confidence when the wallet or category is not one of the user’s', async () => {
    useFakeLLM(
      aiAnswer({ walletName: 'SBI', categoryName: 'Snacks', merchant: 'Corner shop', note: null }),
    );
    const { draft } = (await parseText('250 at corner shop')).body.data;
    expect(draft).toMatchObject({ walletId: null, categoryId: null, aiConfidence: 0.6 });
  });

  it('never accepts a future date from the AI', async () => {
    useFakeLLM(aiAnswer({ date: '2027-01-01' }));
    expect((await parseText('spent 250')).body.data.draft.date).toBe('2026-09-24');
  });

  it('works without AI when the user turned it off', async () => {
    const llm = useFakeLLM(aiAnswer());
    await asha.patch('/api/users/me/settings').send({ aiEnabled: false });

    const res = await parseText('spent 250 on biryani yesterday from GPay');

    expect(llm.calls).toHaveLength(0);
    expect(res.body.data.usedAI).toBe(false);
    expect(res.body.data.draft).toMatchObject({
      type: 'expense',
      amount: 25000,
      merchant: 'biryani',
      date: '2026-09-23',
      categoryId: category['Food & Dining'].id, // keyword rule
      aiConfidence: 0.5,
    });
  });

  it('falls back to the plain parser when the AI is down', async () => {
    useFakeLLM(new LLMRequestError('AI provider replied 503', { status: 503, retryable: true }));
    const res = await parseText('uber 180 last friday');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      usedAI: false,
      draft: { amount: 18000, date: '2026-09-18', categoryId: category.Transport.id },
    });
  });

  it('uses what the user taught it before any rule', async () => {
    useNoLLM();
    await MerchantMap.create({
      userId: asha.user.id,
      merchantKey: 'biryani',
      categoryId: category.Groceries.id,
    });
    const { draft } = (await parseText('spent 250 on biryani')).body.data;
    expect(draft.categoryId).toBe(category.Groceries.id);
  });

  it('explains when no amount is found', async () => {
    useNoLLM();
    const res = await parseText('bought lunch');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOTHING_FOUND');
  });

  it('rejects empty and very long notes', async () => {
    expect((await parseText('   ')).status).toBe(400);
    expect((await parseText('x'.repeat(501))).status).toBe(400);
  });

  it('limits AI requests to 20 a minute per user', async () => {
    useNoLLM();
    for (let i = 0; i < 20; i += 1) expect((await parseText('spent 10')).status).toBe(200);
    const res = await parseText('spent 10');
    expect(res.status).toBe(429);
  });
});

describe('POST /api/ai/parse/sms', () => {
  const [hdfcUpi, , , sbi, , , , , salary, , atm] = TRANSACTION_SMS.map((s) => s.text);
  const otp = SKIPPED_SMS.find((s) => s.reason === 'otp').text;
  // No word the patterns know (paid, debited…), so only the AI can read it.
  const odd = 'Txn of Rs 349 at Chaayos Koramangala using wallet. Bal Rs 20.';
  const unknown = 'Your wallet balance of Rs.120 changed recently.';

  it('reads known formats with patterns and skips OTPs, without AI', async () => {
    useNoLLM();
    const res = await parseSms([hdfcUpi, otp, sbi, unknown].join('\n\n'));

    expect(res.status).toBe(200);
    const { items, usedAI } = res.body.data;
    expect(usedAI).toBe(false);
    expect(items.map((i) => i.status)).toEqual(['ready', 'skipped', 'ready', 'skipped']);
    expect(items[1].reason).toBe('otp');
    expect(items[3].reason).toBe('unknown_format');
    expect(items[0]).toMatchObject({
      via: 'regex',
      possibleDuplicate: false,
      draft: {
        type: 'expense',
        amount: 25000,
        merchant: 'Swiggy',
        date: '2026-09-24',
        walletId: wallets.bank.id, // "HDFC" in the SMS matches the HDFC wallet
        categoryId: category['Food & Dining'].id,
        note: 'Ref 426712345678',
        source: 'sms',
        aiConfidence: 0.9,
      },
    });
    // No wallet mentions SBI → no wallet, lower confidence
    expect(items[2].draft).toMatchObject({ walletId: null, aiConfidence: 0.7 });
  });

  it('asks the AI only about formats it doesn’t know', async () => {
    const llm = useFakeLLM((request) =>
      request.user.includes('#1')
        ? {
            results: [
              {
                index: 1,
                isTransaction: true,
                type: 'expense',
                amount: 349,
                merchant: 'Chaayos',
                date: null,
                confidence: 0.8,
              },
            ],
          }
        : { results: [] },
    );
    const res = await parseSms([sbi, odd].join('\n\n'));

    const { items, usedAI } = res.body.data;
    expect(usedAI).toBe(true);
    expect(items[0].via).toBe('regex');
    expect(items[1]).toMatchObject({
      via: 'ai',
      status: 'ready',
      draft: { amount: 34900, merchant: 'Chaayos', date: '2026-09-24', aiConfidence: 0.7 },
    });
    // Only the unknown message was sent, masked and fenced as data.
    expect(llm.calls[0].user).toContain('<data label="sms">');
    expect(llm.calls[0].user).not.toContain('RAPIDO');
  });

  it('turns ATM withdrawals into a transfer to the cash wallet', async () => {
    useNoLLM();
    const { items } = (await parseSms(atm)).body.data;
    expect(items[0].draft).toMatchObject({
      type: 'transfer',
      amount: 200000,
      toWalletId: wallets.cash.id,
      categoryId: null,
      note: 'ATM withdrawal',
    });
  });

  it('flags payments that are already in the app or pasted twice', async () => {
    useNoLLM();
    // The ₹250 Swiggy payment was already added by hand, a day earlier.
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 25000,
      walletId: wallets.bank.id,
      date: '2026-09-23',
    });
    const { items } = (await parseSms([hdfcUpi, salary, salary].join('\n\n'))).body.data;
    expect(items.map((i) => i.possibleDuplicate)).toEqual([true, false, true]);
    expect(items[1].draft.categoryId).toBe(category.Salary.id);
  });
});
