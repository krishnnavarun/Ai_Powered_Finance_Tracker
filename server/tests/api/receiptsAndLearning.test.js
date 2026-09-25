import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { MerchantMap } from '../../src/models/MerchantMap.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeLLM, useNoLLM } from '../helpers/fakeLLM.js';
import { setUpMoney } from '../helpers/fixtures.js';
import { FAKE_JPEG, JPEG, PNG } from '../helpers/images.js';

let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  asha = await signUp(createApp(), { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.useRealTimers();
  await clearTestDB();
});
resetLLMAfterEach();

const scan = (buffer = JPEG, filename = 'bill.jpg') =>
  asha.post('/api/ai/parse/receipt').attach('receipt', buffer, filename);

const receiptAnswer = (overrides = {}) => ({
  isReceipt: true,
  merchant: 'DMart',
  date: '2026-09-23',
  total: 624.76,
  tax: 29.76,
  items: [
    { name: 'Milk', amount: 130 },
    { name: 'Bread', amount: 45 },
    { name: 'Rice 5kg', amount: 420 },
    { name: 'Eggs', amount: 84 },
  ],
  categoryName: 'Groceries',
  confidence: 0.88,
  ...overrides,
});

describe('POST /api/ai/parse/receipt', () => {
  it('reads the photo with AI vision into a draft', async () => {
    const llm = useFakeLLM(receiptAnswer());
    const res = await scan();

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      usedAI: true,
      tax: 2976,
      items: expect.arrayContaining([{ name: 'Milk', amount: 130 }]),
      draft: {
        type: 'expense',
        amount: 62476,
        merchant: 'DMart',
        date: '2026-09-23',
        categoryId: category.Groceries.id,
        note: 'Milk, Bread, Rice 5kg and 1 more',
        source: 'receipt',
        aiConfidence: 0.88,
      },
    });
    // The photo went to the model as base64 with its real type.
    expect(llm.calls[0].image).toEqual({ mimeType: 'image/jpeg', base64: JPEG.toString('base64') });
  });

  it('says so when the photo is not a receipt', async () => {
    useFakeLLM(receiptAnswer({ isReceipt: false, total: null }));
    const res = await scan(PNG, 'cat.png');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOT_A_RECEIPT');
  });

  it('checks the file really is an image', async () => {
    useFakeLLM(receiptAnswer());
    const res = await scan(FAKE_JPEG, 'bill.jpg');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  it('needs AI: turned off or not set up', async () => {
    useFakeLLM(receiptAnswer());
    await asha.patch('/api/users/me/settings').send({ aiEnabled: false });
    expect((await scan()).body.error.code).toBe('AI_DISABLED');

    await asha.patch('/api/users/me/settings').send({ aiEnabled: true });
    useNoLLM();
    expect((await scan()).body.error.code).toBe('AI_UNAVAILABLE');
  });
});

describe('POST /api/ai/parse/receipt-text (read on the device)', () => {
  it('turns OCR text into a draft without AI', async () => {
    const llm = useFakeLLM({});
    await asha.patch('/api/users/me/settings').send({ aiEnabled: false });

    const res = await asha.post('/api/ai/parse/receipt-text').send({
      text: 'Apollo Pharmacy\nDate 22/09/2026\nParacetamol 30.00\nAmount Payable: 1,250.50',
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      usedAI: false,
      draft: {
        amount: 125050,
        merchant: 'Apollo Pharmacy',
        date: '2026-09-22',
        categoryId: category.Health.id,
        source: 'receipt',
        aiConfidence: 0.5,
      },
    });
    expect(llm.calls).toHaveLength(0);
  });

  it('explains when no total can be found', async () => {
    const res = await asha.post('/api/ai/parse/receipt-text').send({ text: 'blurry blurry' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('NOTHING_FOUND');
  });
});

describe('POST /api/ai/categorize', () => {
  it('uses memory, then rules, then AI for the rest', async () => {
    await MerchantMap.create({
      userId: asha.user.id,
      merchantKey: 'swiggy',
      categoryId: category.Groceries.id, // this user files Swiggy (Instamart) as groceries
    });
    const llm = useFakeLLM({
      results: [{ index: 2, categoryName: 'Entertainment', confidence: 0.7 }],
    });

    const res = await asha.post('/api/ai/categorize').send({
      items: [
        { type: 'expense', merchant: 'SWIGGY*Order 8841' },
        { type: 'expense', merchant: 'Uber India' },
        { type: 'expense', merchant: 'Timezone arcade' },
        { type: 'transfer', note: 'to savings' },
      ],
    });

    expect(res.body.data.suggestions).toEqual([
      { categoryId: category.Groceries.id, confidence: 1, via: 'memory' },
      { categoryId: category.Transport.id, confidence: 0.85, via: 'rule' },
      { categoryId: category.Entertainment.id, confidence: 0.7, via: 'ai' },
      { categoryId: null, confidence: null, via: null },
    ]);
    // Only the unknown merchant was sent to the AI.
    expect(llm.calls[0].user).toContain('Timezone arcade');
    expect(llm.calls[0].user).not.toContain('Uber');
  });
});

describe('the categorizer learns from the user', () => {
  const memoryFor = async (merchantKey) =>
    MerchantMap.findOne({ userId: asha.user.id, merchantKey }).lean();

  it('remembers the category picked for a merchant', async () => {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 50000,
      walletId: wallets.bank.id,
      categoryId: category.Health.id,
      merchant: 'Cult.fit',
      date: '2026-09-20',
    });
    expect(await memoryFor('cult fit')).toMatchObject({
      categoryId: expect.anything(),
      hits: 1,
    });
    expect(String((await memoryFor('cult fit')).categoryId)).toBe(category.Health.id);
  });

  it('learns from a corrected category, and the next suggestion follows it', async () => {
    useNoLLM();
    const created = await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 39900,
      walletId: wallets.bank.id,
      merchant: 'Swiggy Instamart',
      date: '2026-09-20',
    });
    await asha
      .patch(`/api/transactions/${created.body.data.transaction.id}`)
      .send({ categoryId: category.Groceries.id });

    const { suggestions } = (
      await asha
        .post('/api/ai/categorize')
        .send({ items: [{ type: 'expense', merchant: 'SWIGGY INSTAMART' }] })
    ).body.data;
    expect(suggestions[0]).toMatchObject({ categoryId: category.Groceries.id, via: 'memory' });
  });

  it('learns from bulk re-categorising', async () => {
    const make = (merchant) =>
      asha.post('/api/transactions').send({
        type: 'expense',
        amount: 10000,
        walletId: wallets.cash.id,
        merchant,
        date: '2026-09-20',
      });
    const ids = [
      (await make('Tea stall')).body.data.transaction.id,
      (await make('Tea stall')).body.data.transaction.id,
    ];

    await asha
      .post('/api/transactions/bulk')
      .send({ action: 'categorize', ids, categoryId: category['Food & Dining'].id });

    const memory = await memoryFor('tea stall');
    expect(String(memory.categoryId)).toBe(category['Food & Dining'].id);
  });

  it('does not learn from transactions without a merchant', async () => {
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 10000,
      walletId: wallets.cash.id,
      categoryId: category.Health.id,
      date: '2026-09-20',
    });
    expect(await MerchantMap.countDocuments({ userId: asha.user.id })).toBe(0);
  });
});
