import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { MerchantMap } from '../../src/models/MerchantMap.js';
import { Transaction } from '../../src/models/Transaction.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { resetLLMAfterEach, useFakeLLM, useNoLLM } from '../helpers/fakeLLM.js';
import { balanceOf, expectBalancesConsistent, setUpMoney } from '../helpers/fixtures.js';
import { HDFC_CSV, NO_HEADER_CSV } from '../fixtures/statements.js';

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

const preview = (csv, { filename = 'statement.csv', mapping } = {}) => {
  const req = asha.post('/api/import/csv/preview');
  if (mapping) req.field('mapping', JSON.stringify(mapping));
  return req.attach('statement', Buffer.from(csv), filename);
};
const commit = (body) => asha.post('/api/import/csv/commit').send(body);

describe('POST /api/import/csv/preview', () => {
  it('reads the statement, suggests categories and marks duplicates', async () => {
    useNoLLM();
    // The Swiggy payment was already added by hand.
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 25000,
      walletId: wallets.bank.id,
      date: '2026-09-02',
    });

    const res = await preview(HDFC_CSV);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toMatchObject({
      needsMapping: false,
      headerIndex: 4,
      mapping: { date: 0, description: 1, debit: 4, credit: 5 },
      headers: expect.arrayContaining(['Narration', 'Withdrawal Amt.']),
      dayFirst: true,
      skipped: 2,
      usedAI: false,
    });
    expect(data.rows).toHaveLength(5);
    expect(data.rows[0]).toMatchObject({
      date: '2026-09-01',
      type: 'income',
      amount: 6000000,
      merchant: 'Acme Corp',
      categoryId: category.Salary.id,
      via: 'rule',
      duplicate: false,
    });
    expect(data.rows[1]).toMatchObject({
      merchant: 'Swiggy',
      categoryId: category['Food & Dining'].id,
      duplicate: true,
    });
    expect(data.rows[4]).toMatchObject({
      merchant: 'Bajaj Finance Ltd',
      categoryId: category['EMI/Loans'].id,
    });
  });

  it('asks the AI only about merchants the rules don’t know, once each', async () => {
    // The prompt numbers each merchant ("0. expense: Timezone Arcade | …").
    const llm = useFakeLLM((request) => {
      const line = /(\d+)\. expense: Timezone Arcade/.exec(request.user);
      return {
        results: line
          ? [{ index: Number(line[1]), categoryName: 'Entertainment', confidence: 0.6 }]
          : [],
      };
    });
    const csv =
      'Date,Description,Amount\n' +
      '20/09/2026,TIMEZONE ARCADE,-500\n' +
      '21/09/2026,UBER INDIA,-180\n' +
      '22/09/2026,TIMEZONE ARCADE,-300\n';

    const { rows, usedAI } = (await preview(csv)).body.data;

    expect(usedAI).toBe(true);
    expect(rows.map((r) => [r.merchant, r.via])).toEqual([
      ['Timezone Arcade', 'ai'],
      ['Uber India', 'rule'],
      ['Timezone Arcade', 'ai'],
    ]);
    expect(rows[2].categoryId).toBe(category.Entertainment.id);
    expect(llm.calls).toHaveLength(1);
    expect(llm.calls[0].user.match(/Timezone Arcade/g)).toHaveLength(1);
    expect(llm.calls[0].user).not.toContain('Uber');
  });

  it('lets the user pick the columns when the header is unknown', async () => {
    useNoLLM();
    const first = await preview(NO_HEADER_CSV);
    expect(first.body.data).toMatchObject({
      needsMapping: true,
      headerIndex: -1,
      headers: ['a', 'b', 'c'],
      sample: [['1', '2', '3']],
      rows: [],
    });

    const csv = 'when,what,how much\n24/09/2026,Chai,-20\n';
    const picked = await preview(csv, {
      mapping: {
        headerIndex: 0,
        mapping: {
          date: 0,
          description: 1,
          amount: 2,
          debit: null,
          credit: null,
          drcr: null,
          reference: null,
          balance: null,
        },
      },
    });
    expect(picked.body.data.rows).toEqual([
      expect.objectContaining({
        date: '2026-09-24',
        type: 'expense',
        amount: 2000,
        merchant: 'Chai',
      }),
    ]);
  });

  it('asks the AI for the columns when it can’t tell', async () => {
    useFakeLLM((request) =>
      request.purpose === undefined && request.system.includes('header line')
        ? {
            headerIndex: 0,
            date: 0,
            description: 1,
            amount: 2,
            debit: null,
            credit: null,
            drcr: null,
            reference: null,
            balance: null,
          }
        : { results: [] },
    );
    const res = await preview('when,what,how much\n24/09/2026,Chai,-20\n');
    expect(res.body.data).toMatchObject({ needsMapping: false, usedAI: true });
    expect(res.body.data.rows[0]).toMatchObject({ amount: 2000, type: 'expense' });
  });

  it.each([
    ['an Excel file', Buffer.from('PK\u0003\u0004 zip'), 'statement.csv'],
    ['a photo', Buffer.from('ff d8'), 'photo.jpg'],
  ])('refuses %s', async (_name, buffer, filename) => {
    const res = await asha.post('/api/import/csv/preview').attach('statement', buffer, filename);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });
});

describe('POST /api/import/csv/commit', () => {
  const rows = () => [
    {
      date: '2026-09-01',
      type: 'income',
      amount: 6000000,
      merchant: 'Acme Corp',
      note: 'NEFT CR-HDFC0000001-ACME CORP-SALARY SEP',
      categoryId: category.Salary.id,
      aiConfidence: 0.85,
    },
    {
      date: '2026-09-02',
      type: 'expense',
      amount: 25000,
      merchant: 'Swiggy',
      categoryId: category['Food & Dining'].id,
    },
    { date: '2026-09-05', type: 'expense', amount: 184550, merchant: 'Tea stall' },
  ];

  it('keeps the wallet balance by default (the statement is history)', async () => {
    const res = await commit({ walletId: wallets.bank.id, rows: rows() });

    expect(res.status).toBe(201);
    expect(res.body.data).toEqual({ imported: 3 });
    expect(await balanceOf(wallets.bank)).toBe(5000000); // unchanged
    await expectBalancesConsistent(asha.user.id);

    const saved = await Transaction.find({ userId: asha.user.id }).sort({ date: 1 }).lean();
    expect(saved.map((t) => [t.source, t.merchantKey, t.amount])).toEqual([
      ['csv', 'acme corp', 6000000],
      ['csv', 'swiggy', 25000],
      ['csv', 'tea stall', 184550],
    ]);
    // Dates are local days in the user's time zone.
    expect(saved[0].date.toISOString()).toBe('2026-08-31T18:30:00.000Z');
    // The confirmed categories teach the categorizer.
    expect(await MerchantMap.countDocuments({ userId: asha.user.id })).toBe(2);
  });

  it('can add the payments to the balance instead', async () => {
    await commit({ walletId: wallets.bank.id, keepBalance: false, rows: rows() });
    // ₹50,000 + ₹60,000 − ₹250 − ₹1,845.50
    expect(await balanceOf(wallets.bank)).toBe(5000000 + 6000000 - 25000 - 184550);
    await expectBalancesConsistent(asha.user.id);
  });

  it('saves nothing when one row is wrong', async () => {
    const bad = rows();
    bad[2].categoryId = category.Salary.id; // an income category on an expense
    const res = await commit({ walletId: wallets.bank.id, rows: bad });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('rows.2.categoryId');
    expect(await Transaction.countDocuments({ userId: asha.user.id })).toBe(0);
  });

  it('refuses another user’s wallet or category', async () => {
    const ravi = await signUp(createApp(), { name: 'Ravi' });
    const raviWallet = (await ravi.post('/api/wallets').send({ name: 'R', type: 'bank' })).body.data
      .wallet;

    expect((await commit({ walletId: raviWallet.id, rows: rows() })).status).toBe(404);

    const raviCategories = (await ravi.get('/api/categories')).body.data.categories;
    const theirs = raviCategories.find((c) => c.name === 'Salary');
    const res = await commit({
      walletId: wallets.bank.id,
      rows: [{ ...rows()[0], categoryId: theirs.id }],
    });
    expect(res.status).toBe(400);
    expect(await Transaction.countDocuments({})).toBe(0);
  });

  it('checks every row', async () => {
    const res = await commit({
      walletId: wallets.bank.id,
      rows: [{ date: '24/09/2026', type: 'transfer', amount: -5 }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['rows.0.date', 'rows.0.type', 'rows.0.amount']),
    );
  });
});
