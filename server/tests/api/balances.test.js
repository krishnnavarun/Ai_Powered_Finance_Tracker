import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/app.js';
import { Transaction } from '../../src/models/Transaction.js';
import { Wallet } from '../../src/models/Wallet.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { balanceOf, expectBalancesConsistent, setUpMoney } from '../helpers/fixtures.js';

// Wallet balances must always equal opening balance + the effect of every transaction,
// whatever happens: edits, deletes, transfers, failures halfway, many requests at once.

let app;
let asha;
let wallets;
let category;

beforeAll(startTestDB);
afterAll(stopTestDB);
beforeEach(async () => {
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  ({ wallets, category } = await setUpMoney(asha));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await clearTestDB();
});

// Small seeded random generator, so a failing run can be replayed exactly.
function randomGenerator(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// These are stress tests (many writes, retried on conflict), so they get more time
// than the 5s default — they check that balances are right, not how fast.
describe('balance consistency', { timeout: 60_000 }, () => {
  it.each([1, 2, 3])(
    'holds through 60 random creates, edits, deletes and transfers (seed %i)',
    async (seed) => {
      const random = randomGenerator(seed);
      const pick = (list) => list[Math.floor(random() * list.length)];
      const amount = () => 1 + Math.floor(random() * 500000);
      const walletIds = Object.values(wallets).map((w) => w.id);
      const expenseCategories = ['Food & Dining', 'Groceries', 'Transport'].map(
        (name) => category[name].id,
      );
      const created = [];

      for (let step = 0; step < 60; step++) {
        const roll = random();
        if (roll < 0.35 || created.length === 0) {
          const res = await asha.post('/api/transactions').send({
            type: 'expense',
            amount: amount(),
            walletId: pick(walletIds),
            categoryId: pick(expenseCategories),
            date: '2026-09-20',
          });
          created.push(res.body.data.transaction.id);
        } else if (roll < 0.5) {
          const res = await asha.post('/api/transactions').send({
            type: 'income',
            amount: amount(),
            walletId: pick(walletIds),
            date: '2026-09-20',
          });
          created.push(res.body.data.transaction.id);
        } else if (roll < 0.62) {
          const [from, to] = [pick(walletIds), pick(walletIds)];
          const res = await asha
            .post('/api/wallets/transfer')
            .send({ fromWalletId: from, toWalletId: to, amount: amount(), date: '2026-09-20' });
          // Same-wallet transfers are rejected and must change nothing.
          if (from === to) expect(res.status).toBe(400);
          else created.push(res.body.data.transaction.id);
        } else if (roll < 0.85) {
          const id = pick(created);
          const change = pick([
            { amount: amount() },
            { walletId: pick(walletIds) },
            { type: 'income', categoryId: null },
            { type: 'transfer', toWalletId: pick(walletIds) },
          ]);
          await asha.patch(`/api/transactions/${id}`).send(change); // may be rejected; fine
        } else {
          const id = created.splice(Math.floor(random() * created.length), 1)[0];
          expect((await asha.delete(`/api/transactions/${id}`)).status).toBe(204);
        }
      }

      expect(await Transaction.countDocuments({ userId: asha.user.id })).toBe(created.length);
      await expectBalancesConsistent(asha.user.id);
    },
  );

  it('stays correct when many requests hit the same wallet at once', async () => {
    const requests = Array.from({ length: 25 }, () =>
      asha.post('/api/transactions').send({
        type: 'expense',
        amount: 10000,
        walletId: wallets.cash.id,
        date: '2026-09-20',
      }),
    );
    const results = await Promise.all(requests);

    expect(results.every((res) => res.status === 201)).toBe(true);
    expect(await balanceOf(wallets.cash)).toBe(500000 - 25 * 10000);
    await expectBalancesConsistent(asha.user.id);
  });

  it('stays correct with parallel edits and deletes of different transactions', async () => {
    const ids = [];
    for (let i = 0; i < 10; i++) {
      ids.push(
        (
          await asha.post('/api/transactions').send({
            type: 'expense',
            amount: 10000,
            walletId: wallets.cash.id,
            date: '2026-09-20',
          })
        ).body.data.transaction.id,
      );
    }

    await Promise.all(
      ids.map((id, i) =>
        i % 2
          ? asha.delete(`/api/transactions/${id}`)
          : asha.patch(`/api/transactions/${id}`).send({ walletId: wallets.bank.id, amount: 5000 }),
      ),
    );

    expect(await balanceOf(wallets.cash)).toBe(500000);
    expect(await balanceOf(wallets.bank)).toBe(5000000 - 5 * 5000);
    await expectBalancesConsistent(asha.user.id);
  });

  it('saves nothing if updating the balance fails halfway', async () => {
    vi.spyOn(Wallet, 'bulkWrite').mockRejectedValueOnce(new Error('connection lost'));

    const res = await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 10000,
      walletId: wallets.cash.id,
      date: '2026-09-20',
    });

    expect(res.status).toBe(500);
    expect(await Transaction.countDocuments({ userId: asha.user.id })).toBe(0);
    expect(await balanceOf(wallets.cash)).toBe(500000);
  });

  it('keeps the old version if an edit fails halfway', async () => {
    const { transaction } = (
      await asha.post('/api/transactions').send({
        type: 'expense',
        amount: 10000,
        walletId: wallets.cash.id,
        date: '2026-09-20',
      })
    ).body.data;
    vi.spyOn(Wallet, 'bulkWrite').mockRejectedValueOnce(new Error('connection lost'));

    const res = await asha.patch(`/api/transactions/${transaction.id}`).send({ amount: 99000 });

    expect(res.status).toBe(500);
    expect((await Transaction.findById(transaction.id)).amount).toBe(10000);
    expect(await balanceOf(wallets.cash)).toBe(500000 - 10000);
  });
});
