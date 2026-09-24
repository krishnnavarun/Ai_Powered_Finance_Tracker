import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, startOfLocalDay, toInstant } from '../utils/dates.js';
import { normalizeMerchant } from '../utils/merchant.js';
import { findOwnedOrThrow } from './ownership.js';
import { removeReceiptFiles } from './receipt.service.js';

const { ObjectId } = mongoose.Types;
const DEFAULT_TIME_ZONE = 'Asia/Kolkata';
const EDITABLE_FIELDS = [
  'type',
  'amount',
  'walletId',
  'toWalletId',
  'categoryId',
  'merchant',
  'note',
  'tags',
  'date',
];

async function userTimeZone(userId) {
  const user = await User.findById(userId).select('timezone').lean();
  return user?.timezone ?? DEFAULT_TIME_ZONE;
}

function invalid(path, message) {
  return new ApiError(400, 'VALIDATION_ERROR', message, [{ path, message }]);
}

// ---- Balance maths --------------------------------------------------------------

// How a transaction changes wallet balances, as [{ walletId, delta }].
export function balanceEffects({ type, amount, walletId, toWalletId }) {
  if (type === 'income') return [{ walletId, delta: amount }];
  if (type === 'expense') return [{ walletId, delta: -amount }];
  return [
    { walletId, delta: -amount },
    { walletId: toWalletId, delta: amount },
  ];
}

// Net change per wallet after applying `added` effects and undoing `removed` ones.
// Wallets whose net change is zero are left out. Returns [[walletId, delta], ...].
export function netDeltas(added = [], removed = []) {
  const totals = new Map();
  const bump = (walletId, delta) => {
    const key = String(walletId);
    totals.set(key, (totals.get(key) ?? 0) + delta);
  };
  added.forEach(({ walletId, delta }) => bump(walletId, delta));
  removed.forEach(({ walletId, delta }) => bump(walletId, -delta));
  return [...totals].filter(([, delta]) => delta !== 0);
}

async function applyDeltas(userId, deltas, session) {
  if (deltas.length === 0) return;
  const result = await Wallet.bulkWrite(
    deltas.map(([walletId, delta]) => ({
      updateOne: { filter: { _id: walletId, userId }, update: { $inc: { balance: delta } } },
    })),
    { session },
  );
  // Aborts the whole database transaction if a wallet vanished mid-way.
  if (result.matchedCount !== deltas.length) throw ApiError.notFound('Wallet not found');
}

// ---- Validation of the final transaction ----------------------------------------

function sameId(a, b) {
  return Boolean(a) && Boolean(b) && String(a) === String(b);
}

// Checks a transaction as it will be saved (after merging any edits) and returns the
// cleaned fields. `previous` is the stored version when editing: archived wallets and
// categories it already used may stay, but new ones can't be archived.
export async function resolveTransaction(userId, draft, { session, previous } = {}) {
  const txn = { ...draft };

  if (txn.type === 'transfer') {
    if (!txn.toWalletId) throw invalid('toWalletId', 'Choose the wallet to transfer to');
    if (sameId(txn.toWalletId, txn.walletId)) {
      throw invalid('toWalletId', 'Choose two different wallets for a transfer');
    }
    if (txn.categoryId) throw invalid('categoryId', 'Transfers don’t have a category');
    txn.categoryId = null;
  } else {
    txn.toWalletId = null;
  }

  for (const walletId of [txn.walletId, txn.toWalletId].filter(Boolean)) {
    const wallet = await findOwnedOrThrow(Wallet, userId, walletId, { label: 'Wallet', session });
    const alreadyUsed =
      sameId(previous?.walletId, walletId) || sameId(previous?.toWalletId, walletId);
    if (wallet.isArchived && !alreadyUsed) {
      throw new ApiError(
        400,
        'WALLET_ARCHIVED',
        `"${wallet.name}" is archived. Restore it before adding transactions to it.`,
      );
    }
  }

  if (txn.categoryId) {
    const category = await findOwnedOrThrow(Category, userId, txn.categoryId, {
      label: 'Category',
      session,
    });
    if (category.type !== txn.type) {
      throw invalid('categoryId', `"${category.name}" is an ${category.type} category`);
    }
    if (category.isArchived && !sameId(previous?.categoryId, txn.categoryId)) {
      throw new ApiError(400, 'CATEGORY_ARCHIVED', `"${category.name}" is archived.`);
    }
  }

  txn.merchantKey = normalizeMerchant(txn.merchant);
  return txn;
}

// ---- Create / edit / delete (each one atomic with its balance changes) -----------

export async function createTransaction(userId, data) {
  const timeZone = await userTimeZone(userId);
  return mongoose.connection.transaction(async (session) => {
    const txn = await resolveTransaction(
      userId,
      { ...data, date: toInstant(data.date, timeZone) },
      { session },
    );
    const [created] = await Transaction.create([{ ...txn, userId }], { session });
    await applyDeltas(userId, netDeltas(balanceEffects(created)), session);
    return created;
  });
}

export async function getTransaction(userId, transactionId) {
  return findOwnedOrThrow(Transaction, userId, transactionId, { label: 'Transaction' });
}

export async function updateTransaction(userId, transactionId, changes) {
  const timeZone = changes.date ? await userTimeZone(userId) : null;

  return mongoose.connection.transaction(async (session) => {
    const existing = await findOwnedOrThrow(Transaction, userId, transactionId, {
      label: 'Transaction',
      session,
    });
    const previous = existing.toObject();

    const merged = Object.fromEntries(EDITABLE_FIELDS.map((field) => [field, previous[field]]));
    Object.assign(merged, changes);
    if (changes.date) merged.date = toInstant(changes.date, timeZone);
    // Switching between transfer and income/expense: drop the field that no longer applies.
    if (merged.type !== 'transfer' && !('toWalletId' in changes)) merged.toWalletId = null;
    if (merged.type === 'transfer' && !('categoryId' in changes)) merged.categoryId = null;

    const txn = await resolveTransaction(userId, merged, { session, previous });
    existing.set(txn);
    await existing.save({ session });
    // Undo what the old version did, apply what the new version does.
    await applyDeltas(userId, netDeltas(balanceEffects(txn), balanceEffects(previous)), session);
    // CP16: a changed category also teaches the categorizer (MerchantMap).
    return existing;
  });
}

export async function deleteTransaction(userId, transactionId) {
  const receiptKey = await mongoose.connection.transaction(async (session) => {
    const existing = await findOwnedOrThrow(Transaction, userId, transactionId, {
      label: 'Transaction',
      session,
    });
    await existing.deleteOne({ session });
    await applyDeltas(userId, netDeltas([], balanceEffects(existing)), session);
    return existing.receiptKey;
  });
  // Only after the database change succeeded: remove the receipt photo too.
  await removeReceiptFiles([receiptKey]);
}

export async function transfer(userId, { fromWalletId, toWalletId, amount, date, note }) {
  return createTransaction(userId, {
    type: 'transfer',
    walletId: fromWalletId,
    toWalletId,
    amount,
    date,
    note,
  });
}

// ---- Bulk actions ------------------------------------------------------------------

// Ids that don't exist or belong to someone else are simply counted as not found.
export async function bulkAction(userId, { action, ids, categoryId }) {
  let receiptKeys = [];
  const result = await mongoose.connection.transaction(async (session) => {
    const transactions = await Transaction.find({ userId, _id: { $in: ids } }).session(session);
    const notFound = ids.length - transactions.length;
    const foundIds = transactions.map((txn) => txn._id);

    if (action === 'delete') {
      await Transaction.deleteMany({ userId, _id: { $in: foundIds } }, { session });
      await applyDeltas(userId, netDeltas([], transactions.flatMap(balanceEffects)), session);
      receiptKeys = transactions.map((txn) => txn.receiptKey);
      return { deleted: transactions.length, notFound };
    }

    const category = await findOwnedOrThrow(Category, userId, categoryId, {
      label: 'Category',
      session,
    });
    if (category.isArchived) {
      throw new ApiError(400, 'CATEGORY_ARCHIVED', `"${category.name}" is archived.`);
    }
    // Only transactions of the category's type can take it (transfers never do).
    const matching = transactions.filter((txn) => txn.type === category.type);
    await Transaction.updateMany(
      { userId, _id: { $in: matching.map((txn) => txn._id) } },
      { $set: { categoryId: category._id } },
      { session },
    );
    return { updated: matching.length, skipped: transactions.length - matching.length, notFound };
  });
  await removeReceiptFiles(receiptKeys);
  return result;
}

// ---- Listing ---------------------------------------------------------------------

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const SORTS = {
  '-date': { date: -1, _id: -1 },
  date: { date: 1, _id: 1 },
  '-amount': { amount: -1, date: -1 },
  amount: { amount: 1, date: -1 },
};

// Builds the MongoDB filter. Ids are real ObjectIds because aggregate() doesn't cast.
async function buildFilter(userId, query) {
  const filter = { userId: new ObjectId(userId) };
  const and = [];

  if (query.from || query.to) {
    const timeZone = await userTimeZone(userId);
    filter.date = {};
    if (query.from) filter.date.$gte = startOfLocalDay(query.from, timeZone);
    if (query.to) filter.date.$lt = startOfLocalDay(addDays(query.to, 1), timeZone);
  }
  if (query.type) filter.type = query.type;
  if (query.walletId) {
    const walletId = new ObjectId(query.walletId);
    and.push({ $or: [{ walletId }, { toWalletId: walletId }] });
  }
  if (query.categoryId) {
    // Picking a parent category also shows its sub-categories.
    const children = await Category.find({ userId, parentId: query.categoryId }).distinct('_id');
    filter.categoryId = { $in: [new ObjectId(query.categoryId), ...children] };
  }
  if (query.tag) filter.tags = query.tag;
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    filter.amount = {};
    if (query.minAmount !== undefined) filter.amount.$gte = query.minAmount;
    if (query.maxAmount !== undefined) filter.amount.$lte = query.maxAmount;
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    and.push({ $or: [{ merchant: pattern }, { note: pattern }] });
  }
  if (and.length) filter.$and = and;
  return filter;
}

export async function listTransactions(userId, query) {
  const filter = await buildFilter(userId, query);
  const { page, limit, sort } = query;

  const [transactions, total, sums] = await Promise.all([
    Transaction.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter),
    Transaction.aggregate([
      { $match: filter },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
  ]);

  // Totals of everything matching the filters (not just this page).
  const totals = { income: 0, expense: 0, transfer: 0 };
  for (const { _id, total: sum } of sums) totals[_id] = sum;

  return {
    transactions,
    totals,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}
