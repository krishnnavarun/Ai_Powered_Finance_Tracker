import { describe, expect, it } from 'vitest';
import { balanceEffects, netDeltas } from '../../src/services/transaction.service.js';

describe('balanceEffects', () => {
  it('takes an expense out of the wallet', () => {
    expect(balanceEffects({ type: 'expense', amount: 25000, walletId: 'cash' })).toEqual([
      { walletId: 'cash', delta: -25000 },
    ]);
  });

  it('adds income to the wallet', () => {
    expect(balanceEffects({ type: 'income', amount: 5000000, walletId: 'bank' })).toEqual([
      { walletId: 'bank', delta: 5000000 },
    ]);
  });

  it('moves a transfer from one wallet to the other', () => {
    expect(
      balanceEffects({ type: 'transfer', amount: 100000, walletId: 'bank', toWalletId: 'cash' }),
    ).toEqual([
      { walletId: 'bank', delta: -100000 },
      { walletId: 'cash', delta: 100000 },
    ]);
  });
});

describe('netDeltas', () => {
  it('combines effects per wallet', () => {
    expect(
      netDeltas([
        { walletId: 'cash', delta: -100 },
        { walletId: 'cash', delta: -50 },
        { walletId: 'bank', delta: 200 },
      ]),
    ).toEqual([
      ['cash', -150],
      ['bank', 200],
    ]);
  });

  it('undoes removed effects (an edit from ₹100 to ₹150 costs ₹50 more)', () => {
    const before = [{ walletId: 'cash', delta: -10000 }];
    const after = [{ walletId: 'cash', delta: -15000 }];
    expect(netDeltas(after, before)).toEqual([['cash', -5000]]);
  });

  it('leaves out wallets that end up unchanged', () => {
    const effect = [{ walletId: 'cash', delta: -10000 }];
    expect(netDeltas(effect, effect)).toEqual([]);
  });

  it('handles moving an expense to another wallet', () => {
    expect(
      netDeltas([{ walletId: 'bank', delta: -500 }], [{ walletId: 'cash', delta: -500 }]),
    ).toEqual([
      ['bank', -500],
      ['cash', 500],
    ]);
  });
});
