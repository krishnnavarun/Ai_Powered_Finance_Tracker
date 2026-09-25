import mongoose from 'mongoose';
import { spendingAnomalies, duplicateCharges } from '../ai/analytics/anomaly.js';
import { suggestBudgets } from '../ai/analytics/budgetSuggest.js';
import { forecastMonthEnd } from '../ai/analytics/forecast.js';
import { healthScore } from '../ai/analytics/healthScore.js';
import { detectSubscriptions } from '../ai/analytics/subscriptions.js';
import { simulateWhatIf } from '../ai/analytics/whatIf.js';
import { Category } from '../models/Category.js';
import { Goal } from '../models/Goal.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { Subscription } from '../models/Subscription.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import {
  addDays,
  daysBetween,
  localDateOf,
  monthContaining,
  monthRange,
  previousMonth,
  startOfLocalDay,
} from '../utils/dates.js';
import { upcomingOccurrences } from '../utils/recurrence.js';
import { budgetStatusFor } from './budget.service.js';
import { findOwnedOrThrow } from './ownership.js';
import { monthlyTrend, spendingByCategory } from './reports.service.js';
import { getUserPrefs } from './userPrefs.js';

// Loads the user's data for the pure analytics functions in ai/analytics/. No AI here:
// every number is plain maths, so it works with AI off and can be explained.

const { ObjectId } = mongoose.Types;
const NOT_SUBSCRIPTION_KEYS = ['rent', 'emi_loans', 'investments', 'utilities'];

async function context(userId) {
  const prefs = await getUserPrefs(userId);
  const now = new Date();
  const month = monthContaining(now, prefs);
  return {
    prefs,
    timeZone: prefs.timeZone,
    today: localDateOf(now, prefs.timeZone),
    month,
    range: monthRange(month, prefs),
  };
}

async function activeWallets(userId) {
  return Wallet.find({ userId, isArchived: false }).lean();
}

// The last `count` complete budget months, oldest first.
function completeMonths(month, count) {
  const months = [];
  let current = month;
  for (let i = 0; i < count; i += 1) {
    current = previousMonth(current);
    months.unshift(current);
  }
  return months;
}

// ---- Forecast (A7)

export async function forecast(userId) {
  const ctx = await context(userId);
  const { range, today, timeZone } = ctx;
  const historyStart = monthRange(completeMonths(ctx.month, 3)[0], ctx.prefs).start;

  const [wallets, days, history, rules, budgetStatus] = await Promise.all([
    activeWallets(userId),
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
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: timeZone } },
            type: '$type',
            recurring: { $eq: ['$source', 'recurring'] },
          },
          total: { $sum: '$amount' },
        },
      },
    ]),
    // Everyday spending of the last 3 months, to start the daily average from.
    Transaction.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          type: 'expense',
          source: { $ne: 'recurring' },
          date: { $gte: historyStart, $lt: range.start },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' }, first: { $min: '$date' } } },
    ]),
    RecurringRule.find({ userId, active: true, nextDate: { $ne: null } }).lean(),
    budgetStatusFor(userId, { month: ctx.month }),
  ]);

  const byDate = new Map();
  for (const { _id, total } of days) {
    const day = byDate.get(_id.date) ?? {
      date: _id.date,
      income: 0,
      expense: 0,
      recurringExpense: 0,
    };
    day[_id.type] += total;
    if (_id.type === 'expense' && _id.recurring) day.recurringExpense += total;
    byDate.set(_id.date, day);
  }

  let seedDaily = null;
  if (history[0]?.total) {
    // Days from the first expense (or the window start) to the end of last month.
    const from = localDateOf(history[0].first, timeZone);
    const spanDays = Math.max(1, daysBetween(from, addDays(range.fromDate, -1)) + 1);
    seedDaily = Math.round(history[0].total / spanDays);
  }

  const tomorrow = addDays(today, 1);
  const upcoming = rules
    .filter((rule) => rule.template.type !== 'transfer')
    .flatMap((rule) =>
      upcomingOccurrences(
        rule.startDate,
        { frequency: rule.frequency, interval: rule.interval },
        rule.nextDate > tomorrow ? rule.nextDate : tomorrow,
        40,
        rule.endDate,
      )
        .filter((date) => date <= range.toDate)
        .map((date) => ({ date, type: rule.template.type, amount: rule.template.amount })),
    );

  const result = forecastMonthEnd({
    today,
    monthStart: range.fromDate,
    monthEnd: range.toDate,
    balance: wallets.reduce((total, w) => total + w.balance, 0),
    days: [...byDate.values()],
    seedDaily,
    upcoming,
    budgets: budgetStatus.budgets.map((item) => ({
      categoryId: item.budget.categoryId ? String(item.budget.categoryId) : null,
      limit: item.effectiveLimit,
      spent: item.spent,
    })),
  });
  return {
    month: ctx.month,
    fromDate: range.fromDate,
    toDate: range.toDate,
    today,
    ...result,
    upcoming,
  };
}

// ---- Health score (A11)

export async function health(userId) {
  const ctx = await context(userId);
  const [trend, lastMonthBudgets, goals, wallets] = await Promise.all([
    monthlyTrend(userId, { months: 7 }),
    budgetStatusFor(userId, { month: previousMonth(ctx.month) }),
    Goal.find({ userId, status: 'active' }).lean(),
    activeWallets(userId),
  ]);

  // Complete months only, from the first month that has anything in it.
  const complete = trend.slice(0, -1);
  const firstUsed = complete.findIndex((m) => m.income > 0 || m.expense > 0);
  const months = firstUsed === -1 ? [] : complete.slice(firstUsed);

  const result = healthScore({
    months,
    budgets: lastMonthBudgets.budgets.map((item) => ({
      limit: item.effectiveLimit,
      spent: item.spent,
    })),
    goals: goals.map((goal) => {
      let expectedPercent = null;
      if (goal.deadline) {
        const start = localDateOf(goal.createdAt, ctx.timeZone);
        const total = Math.max(1, daysBetween(start, goal.deadline));
        expectedPercent = Math.min(100, Math.max(0, (daysBetween(start, ctx.today) / total) * 100));
      }
      return { ...goal, expectedPercent };
    }),
    // Money that could be used in an emergency: everything except credit cards.
    liquid: wallets
      .filter((w) => w.type !== 'card')
      .reduce((total, w) => total + Math.max(0, w.balance), 0),
  });
  return { ...result, monthsUsed: months.length };
}

// ---- Subscriptions (A9)

export async function subscriptions(userId) {
  const ctx = await context(userId);
  const since = startOfLocalDay(addDays(ctx.today, -400), ctx.timeZone);
  // Rent, EMIs, bills and investments repeat too, but they aren't subscriptions to cancel.
  const notSubscriptions = await Category.find({
    userId,
    systemKey: { $in: NOT_SUBSCRIPTION_KEYS },
  }).distinct('_id');
  const charges = await Transaction.find({
    userId,
    type: 'expense',
    merchantKey: { $nin: ['', null] },
    categoryId: { $nin: notSubscriptions },
    date: { $gte: since },
  })
    .select('merchantKey merchant amount date')
    .lean();

  const found = detectSubscriptions(
    charges.map((c) => ({ ...c, date: localDateOf(c.date, ctx.timeZone) })),
    { today: ctx.today },
  );
  if (found.length) {
    // Refresh the numbers ("late" is worked out fresh each time, so it isn't stored);
    // the user's status choice is never overwritten.
    await Subscription.bulkWrite(
      found.map(({ merchantKey, late: _late, ...fields }) => ({
        updateOne: {
          filter: { userId, merchantKey },
          update: { $set: fields },
          upsert: true,
        },
      })),
    );
  }
  const saved = await Subscription.find({
    userId,
    merchantKey: { $in: found.map((s) => s.merchantKey) },
  });
  const lateByKey = new Map(found.map((s) => [s.merchantKey, s.late]));
  const list = saved
    .map((doc) => ({ ...doc.toJSON(), late: lateByKey.get(doc.merchantKey) }))
    .sort((a, b) => b.yearlyCost - a.yearlyCost);

  const active = list.filter((s) => s.status === 'active');
  return {
    subscriptions: list,
    totals: {
      yearly: active.reduce((total, s) => total + s.yearlyCost, 0),
      monthly: Math.round(active.reduce((total, s) => total + s.yearlyCost, 0) / 12),
      count: active.length,
    },
  };
}

export async function setSubscriptionStatus(userId, id, status) {
  const subscription = await findOwnedOrThrow(Subscription, userId, id, {
    label: 'Subscription',
  });
  subscription.status = status;
  await subscription.save();
  return subscription;
}

// ---- Spending by category over the last 3 complete months

async function recentMonths(userId) {
  const ctx = await context(userId);
  const months = completeMonths(ctx.month, 3);
  const ranges = months.map((month) => monthRange(month, ctx.prefs));
  const [perMonth, trend, categories] = await Promise.all([
    Promise.all(
      ranges.map((range) => spendingByCategory(userId, { from: range.fromDate, to: range.toDate })),
    ),
    monthlyTrend(userId, { months: 4 }),
    Category.find({ userId, type: 'expense', isArchived: false }).lean(),
  ]);

  const complete = trend.slice(0, -1);
  const used = complete.filter((m) => m.income > 0 || m.expense > 0);
  const count = Math.max(1, used.length);
  return {
    ctx,
    months,
    categories: categories
      .filter((c) => !c.parentId)
      .map((c) => ({
        categoryId: String(c._id),
        systemKey: c.systemKey,
        name: c.name,
        months: perMonth.map(
          (month) => month.categories.find((row) => row.categoryId === String(c._id))?.total ?? 0,
        ),
      })),
    income: Math.round(used.reduce((total, m) => total + m.income, 0) / count),
    expense: Math.round(used.reduce((total, m) => total + m.expense, 0) / count),
    monthsWithData: used.length,
  };
}

// ---- Budget autopilot (A10)

export async function budgetSuggestions(userId, { targetSavingsRate = 0.2 } = {}) {
  const data = await recentMonths(userId);
  return {
    basedOn: data.months,
    monthsWithData: data.monthsWithData,
    forMonth: data.ctx.month,
    ...suggestBudgets({ categories: data.categories, income: data.income, targetSavingsRate }),
  };
}

// ---- What-if (A12)

export async function whatIf(userId, { changes }) {
  const data = await recentMonths(userId);
  const goals = await Goal.find({ userId, status: 'active' }).lean();
  const count = Math.max(1, data.monthsWithData);
  return {
    basedOn: data.months,
    ...simulateWhatIf({
      income: data.income,
      expense: data.expense,
      byCategory: data.categories.map((c) => ({
        categoryId: c.categoryId,
        average: Math.round(c.months.reduce((total, m) => total + m, 0) / count),
      })),
      changes,
      goals: goals.map((goal) => ({ ...goal, id: String(goal._id) })),
      today: data.ctx.today,
    }),
  };
}

// ---- Anomalies (A8), for insights

export async function anomalies(userId) {
  const ctx = await context(userId);
  // Weeks run Monday to Sunday; "this week" is the one containing today.
  const weekday = (new Date(`${ctx.today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const thisWeekStart = addDays(ctx.today, -weekday);
  const weekStarts = Array.from({ length: 9 }, (_, i) => addDays(thisWeekStart, (i - 8) * 7));
  const boundaries = [...weekStarts, addDays(thisWeekStart, 7)].map((d) =>
    startOfLocalDay(d, ctx.timeZone),
  );

  const [rows, recent] = await Promise.all([
    Transaction.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          type: 'expense',
          categoryId: { $ne: null },
          date: { $gte: boundaries[0], $lt: boundaries.at(-1) },
        },
      },
      {
        $group: {
          _id: {
            categoryId: '$categoryId',
            week: {
              $switch: {
                branches: boundaries.slice(1).map((end, i) => ({
                  case: { $lt: ['$date', end] },
                  then: i,
                })),
                default: 8,
              },
            },
          },
          total: { $sum: '$amount' },
        },
      },
    ]),
    Transaction.find({
      userId,
      type: 'expense',
      date: { $gte: startOfLocalDay(addDays(ctx.today, -7), ctx.timeZone) },
    })
      .select('merchantKey merchant amount date type')
      .lean(),
  ]);

  const weeks = new Map();
  for (const { _id, total } of rows) {
    const key = String(_id.categoryId);
    if (!weeks.has(key)) weeks.set(key, Array(9).fill(0));
    weeks.get(key)[_id.week] = total;
  }
  return {
    weekStart: thisWeekStart,
    categories: spendingAnomalies(
      [...weeks].map(([categoryId, totals]) => ({
        categoryId,
        history: totals.slice(0, 8),
        thisWeek: totals[8],
      })),
    ),
    duplicates: duplicateCharges(recent.map((t) => ({ ...t, id: String(t._id) }))),
  };
}
