import { expect } from 'vitest';
import { Transaction } from '../../src/models/Transaction.js';
import { Wallet } from '../../src/models/Wallet.js';
import { balanceEffects } from '../../src/services/transaction.service.js';

// Creates three wallets for a signed-up user and returns them by short name,
// plus the user's categories by name.
export async function setUpMoney(user) {
  const make = async (body) => (await user.post('/api/wallets').send(body)).body.data.wallet;
  const wallets = {
    cash: await make({ name: 'Cash', type: 'cash', openingBalance: 500000 }), // ₹5,000
    bank: await make({ name: 'HDFC', type: 'bank', openingBalance: 5000000 }), // ₹50,000
    card: await make({
      name: 'ICICI Card',
      type: 'card',
      openingBalance: 0,
      creditLimit: 10000000,
    }),
  };
  const { categories } = (await user.get('/api/categories')).body.data;
  const category = Object.fromEntries(categories.map((c) => [c.name, c]));
  return { wallets, category };
}

export async function balanceOf(wallet) {
  return (await Wallet.findById(wallet.id)).balance;
}

// The core rule: every wallet's balance = opening balance + the effect of every
// transaction. Checked straight from the database after each test scenario.
export async function expectBalancesConsistent(userId) {
  const wallets = await Wallet.find({ userId }).lean();
  const effects = (await Transaction.find({ userId }).lean()).flatMap(balanceEffects);

  for (const wallet of wallets) {
    const expected =
      wallet.openingBalance +
      effects
        .filter(({ walletId }) => String(walletId) === String(wallet._id))
        .reduce((sum, { delta }) => sum + delta, 0);
    expect(wallet.balance, `balance of "${wallet.name}"`).toBe(expected);
  }
}
