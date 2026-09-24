import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import { ApiError } from '../utils/ApiError.js';
import { findOwnedOrThrow, withUniqueName } from './ownership.js';

const duplicateName = (name) => `You already have a wallet named "${name}"`;

export async function listWallets(userId, { includeArchived = false } = {}) {
  const filter = { userId };
  if (!includeArchived) filter.isArchived = false;
  return Wallet.find(filter).sort({ isArchived: 1, createdAt: 1 });
}

export async function getWallet(userId, walletId) {
  return findOwnedOrThrow(Wallet, userId, walletId, { label: 'Wallet' });
}

export async function createWallet(userId, data) {
  // A new wallet starts at its opening balance.
  return withUniqueName(
    () => Wallet.create({ ...data, userId, balance: data.openingBalance }),
    duplicateName(data.name),
  );
}

// In an update pipeline a string like "$balance" would be read as a field reference;
// $literal makes MongoDB store user-supplied values exactly as given.
function literals(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { $literal: value }]),
  );
}

export async function updateWallet(userId, walletId, changes) {
  const wallet = await getWallet(userId, walletId);
  const { openingBalance, ...fields } = changes;

  const type = fields.type ?? wallet.type;
  if (type !== 'card') {
    if (fields.creditLimit !== undefined && fields.creditLimit !== null) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Only card wallets can have a credit limit');
    }
    if (wallet.creditLimit !== null) fields.creditLimit = null; // it stopped being a card
  }

  const update = [{ $set: literals(fields) }];
  if (openingBalance !== undefined) {
    // One atomic step: balance moves by (new opening − old opening), so transactions
    // recorded at the same moment are never lost.
    update.push({
      $set: {
        balance: {
          $add: ['$balance', { $subtract: [{ $literal: openingBalance }, '$openingBalance'] }],
        },
        openingBalance: { $literal: openingBalance },
      },
    });
  }

  return withUniqueName(
    () =>
      Wallet.findOneAndUpdate({ _id: walletId, userId }, update, {
        returnDocument: 'after',
        updatePipeline: true,
      }),
    duplicateName(fields.name),
  );
}

export async function deleteWallet(userId, walletId) {
  const wallet = await getWallet(userId, walletId);
  // Deleting would leave transactions pointing at nothing; archiving keeps history intact.
  const used = await Transaction.exists({
    userId,
    $or: [{ walletId: wallet._id }, { toWalletId: wallet._id }],
  });
  if (used) {
    throw new ApiError(
      409,
      'WALLET_IN_USE',
      'This wallet has transactions. Archive it to hide it, or delete its transactions first.',
    );
  }
  await wallet.deleteOne();
}
