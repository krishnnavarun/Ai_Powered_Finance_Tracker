import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import {
  addDays,
  addMonths,
  daysBetween,
  localDateOf,
  monthContaining,
  monthRange,
  startOfLocalDay,
} from '../utils/dates.js';
import { getUserPrefs } from './userPrefs.js';

const { ObjectId } = mongoose.Types;

// A date range in the user's time zone; defaults to their current budget month.
export async function resolveRange(userId, { from, to }) {
  const prefs = await getUserPrefs(userId);
  if (from && to) {
    return {
      prefs,
      fromDate: from,
      toDate: to,
      start: startOfLocalDay(from, prefs.timeZone),
      end: startOfLocalDay(addDays(to, 1), prefs.timeZone),
    };
  }
  return { prefs, ...monthRange(monthContaining(new Date(), prefs), prefs) };
}

// Totals per category for a period, biggest first. Sub-categories are added into their
// parent so the breakdown stays short and readable.
export async function spendingByCategory(userId, { from, to, type = 'expense' } = {}) {
  const range = await resolveRange(userId, { from, to });
  const [rows, categories] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          type,
          date: { $gte: range.start, $lt: range.end },
        },
      },
      { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Category.find({ userId }).lean(),
  ]);

  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const groups = new Map();
  for (const row of rows) {
    const own = row._id ? byId.get(String(row._id)) : null;
    const top = own?.parentId ? byId.get(String(own.parentId)) : own;
    const key = top ? String(top._id) : 'uncategorized';
    const group = groups.get(key) ?? {
      categoryId: top ? String(top._id) : null,
      name: top?.name ?? 'Uncategorized',
      icon: top?.icon ?? 'tag',
      color: top?.color ?? '#94a3b8',
      total: 0,
      count: 0,
    };
    group.total += row.total;
    group.count += row.count;
    groups.set(key, group);
  }

  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const list = [...groups.values()]
    .sort((a, b) => b.total - a.total)
    .map((group) => ({
      ...group,
      percent: total ? Math.round((group.total / total) * 1000) / 10 : 0,
    }));

  return { from: range.fromDate, to: range.toDate, type, total, categories: list };
}

// Money in, money out and saved for each of the last `months` budget months
// (following the user's month start day), oldest first. Months with nothing are 0.
export async function monthlyTrend(userId, { months = 6 } = {}) {
  const prefs = await getUserPrefs(userId);
  const current = monthContaining(new Date(), prefs);
  const labels = Array.from({ length: months }, (_, i) =>
    addMonths(`${current}-01`, i - (months - 1)).slice(0, 7),
  );
  const ranges = labels.map((month) => ({ month, ...monthRange(month, prefs) }));
  const boundaries = [...ranges.map((range) => range.start), ranges.at(-1).end];

  const buckets = await Transaction.aggregate([
    {
      $match: {
        userId: new ObjectId(userId),
        type: { $in: ['income', 'expense'] },
        date: { $gte: boundaries[0], $lt: boundaries.at(-1) },
      },
    },
    {
      $bucket: {
        groupBy: '$date',
        boundaries,
        output: {
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
    },
  ]);
  const byStart = new Map(buckets.map((bucket) => [bucket._id.getTime(), bucket]));

  return ranges.map(({ month, fromDate, toDate, start }) => {
    const { income = 0, expense = 0 } = byStart.get(start.getTime()) ?? {};
    return { month, fromDate, toDate, income, expense, saved: income - expense };
  });
}

// Headline numbers for a period: money in / out, saved, savings rate, average daily
// spending (over the days that have passed) and the single biggest expense.
export async function reportSummary(userId, { from, to } = {}) {
  const range = await resolveRange(userId, { from, to });
  const inRange = { $gte: range.start, $lt: range.end };

  const [totals, biggest] = await Promise.all([
    Transaction.aggregate([
      { $match: { userId: new ObjectId(userId), date: inRange } },
      { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.findOne({ userId, type: 'expense', date: inRange })
      .sort({ amount: -1, date: -1 })
      .lean(),
  ]);
  const sum = (type) => totals.find((row) => row._id === type)?.total ?? 0;
  const income = sum('income');
  const expense = sum('expense');

  // Average over the days so far — a month that is half over shouldn't look cheap.
  const today = localDateOf(new Date(), range.prefs.timeZone);
  const lastDay = today < range.toDate ? today : range.toDate;
  const days = lastDay < range.fromDate ? 0 : daysBetween(range.fromDate, lastDay) + 1;

  return {
    from: range.fromDate,
    to: range.toDate,
    income,
    expense,
    saved: income - expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : null,
    transactionCount: totals.reduce((count, row) => count + row.count, 0),
    days,
    avgDailySpend: days > 0 ? Math.floor(expense / days) : 0,
    biggestExpense: biggest
      ? {
          id: String(biggest._id),
          merchant: biggest.merchant,
          amount: biggest.amount,
          date: biggest.date,
          categoryId: biggest.categoryId ? String(biggest.categoryId) : null,
        }
      : null,
  };
}

// Where the money was spent: merchants by total, biggest first. Spellings of the same
// shop are grouped by their merchantKey; the most recent spelling is shown.
export async function topMerchants(userId, { from, to, limit = 10 } = {}) {
  const range = await resolveRange(userId, { from, to });
  const rows = await Transaction.aggregate([
    {
      $match: {
        userId: new ObjectId(userId),
        type: 'expense',
        merchantKey: { $ne: '' },
        date: { $gte: range.start, $lt: range.end },
      },
    },
    { $sort: { date: 1 } },
    {
      $group: {
        _id: '$merchantKey',
        name: { $last: '$merchant' },
        total: { $sum: '$amount' },
        count: { $sum: 1 },
        lastDate: { $last: '$date' },
      },
    },
    { $sort: { total: -1, _id: 1 } },
    { $limit: limit },
  ]);
  return {
    from: range.fromDate,
    to: range.toDate,
    merchants: rows.map(({ _id, ...row }) => ({ merchantKey: _id, ...row })),
  };
}

// Money in and out per wallet. Transfers between your own wallets are left out: they
// move money around but aren't earning or spending.
export async function byWallet(userId, { from, to } = {}) {
  const range = await resolveRange(userId, { from, to });
  const [rows, wallets] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          type: { $in: ['income', 'expense'] },
          date: { $gte: range.start, $lt: range.end },
        },
      },
      {
        $group: {
          _id: '$walletId',
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
    ]),
    Wallet.find({ userId }).select('name type color icon').lean(),
  ]);
  const names = new Map(wallets.map((w) => [String(w._id), w]));
  return {
    from: range.fromDate,
    to: range.toDate,
    wallets: rows
      .map((row) => {
        const wallet = names.get(String(row._id));
        return {
          walletId: String(row._id),
          name: wallet?.name ?? 'Deleted wallet',
          type: wallet?.type ?? 'other',
          color: wallet?.color ?? '#94a3b8',
          icon: wallet?.icon ?? 'wallet',
          income: row.income,
          expense: row.expense,
        };
      })
      .sort((a, b) => b.expense - a.expense || b.income - a.income),
  };
}
