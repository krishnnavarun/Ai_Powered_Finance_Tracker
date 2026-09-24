import mongoose from 'mongoose';
import { Budget } from '../models/Budget.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../utils/ApiError.js';
import {
  daysBetween,
  localDateOf,
  monthContaining,
  monthRange,
  previousMonth,
} from '../utils/dates.js';
import { budgetStatus, rolloverAmount } from './budget.math.js';
import { findOwnedOrThrow } from './ownership.js';
import { getUserPrefs } from './userPrefs.js';

const { ObjectId } = mongoose.Types;

async function resolveMonth(userId, month) {
  const prefs = await getUserPrefs(userId);
  return { prefs, month: month ?? monthContaining(new Date(), prefs) };
}

export async function listBudgets(userId, { month } = {}) {
  const resolved = await resolveMonth(userId, month);
  const budgets = await Budget.find({ userId, month: resolved.month }).sort({ createdAt: 1 });
  return { month: resolved.month, budgets };
}

async function checkCategory(userId, categoryId) {
  if (!categoryId) return;
  const category = await findOwnedOrThrow(Category, userId, categoryId, { label: 'Category' });
  if (category.type !== 'expense') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Budgets are for expense categories', [
      { path: 'categoryId', message: `"${category.name}" is an income category` },
    ]);
  }
}

export async function createBudget(userId, data) {
  await checkCategory(userId, data.categoryId);
  try {
    return await Budget.create({ ...data, userId });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ApiError(
        409,
        'BUDGET_EXISTS',
        data.categoryId
          ? 'This category already has a budget for that month'
          : 'You already have an overall budget for that month',
      );
    }
    throw err;
  }
}

export async function updateBudget(userId, budgetId, changes) {
  const budget = await findOwnedOrThrow(Budget, userId, budgetId, { label: 'Budget' });
  // A new limit changes the percentages, so alerts may be due again.
  if (changes.limit !== undefined && changes.limit !== budget.limit) budget.alertsSent = [];
  budget.set(changes);
  return budget.save();
}

export async function deleteBudget(userId, budgetId) {
  const budget = await findOwnedOrThrow(Budget, userId, budgetId, { label: 'Budget' });
  await budget.deleteOne();
}

// Expense totals per category (and overall) between two instants.
async function spendingBetween(userId, { start, end }) {
  const rows = await Transaction.aggregate([
    { $match: { userId: new ObjectId(userId), type: 'expense', date: { $gte: start, $lt: end } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' } } },
  ]);
  const byCategory = new Map(rows.map((row) => [String(row._id), row.total]));
  const overall = rows.reduce((sum, row) => sum + row.total, 0);
  return { byCategory, overall };
}

// Spending for a budget: overall, or its category plus its sub-categories.
function spentFor(categoryId, spending, childrenOf) {
  if (!categoryId) return spending.overall;
  const ids = [String(categoryId), ...(childrenOf.get(String(categoryId)) ?? [])];
  return ids.reduce((sum, id) => sum + (spending.byCategory.get(id) ?? 0), 0);
}

// Days left in the month counting today (0 once it's over; the full month if it hasn't started).
function daysLeftIn({ fromDate, toDate }, today) {
  if (today > toDate) return 0;
  if (today < fromDate) return daysBetween(fromDate, toDate) + 1;
  return daysBetween(today, toDate) + 1;
}

// How every budget of a month is doing: spent, left, percent, per-day allowance.
export async function budgetStatusFor(userId, { month } = {}) {
  const { prefs, month: resolvedMonth } = await resolveMonth(userId, month);
  const range = monthRange(resolvedMonth, prefs);
  const lastMonth = previousMonth(resolvedMonth);

  const [budgets, previousBudgets, categories] = await Promise.all([
    Budget.find({ userId, month: resolvedMonth }).sort({ createdAt: 1 }),
    Budget.find({ userId, month: lastMonth }).lean(),
    Category.find({ userId, parentId: { $ne: null } })
      .select('parentId')
      .lean(),
  ]);

  const childrenOf = new Map();
  for (const { _id, parentId } of categories) {
    const key = String(parentId);
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), String(_id)]);
  }

  const spending = await spendingBetween(userId, range);
  const needsLastMonth = budgets.some((budget) => budget.rollover) && previousBudgets.length > 0;
  const lastSpending = needsLastMonth
    ? await spendingBetween(userId, monthRange(lastMonth, prefs))
    : null;

  const daysLeft = daysLeftIn(range, localDateOf(new Date(), prefs.timeZone));

  const items = budgets.map((budget) => {
    const previous = previousBudgets.find(
      (candidate) => String(candidate.categoryId) === String(budget.categoryId),
    );
    const rollover = rolloverAmount({
      enabled: budget.rollover,
      previousLimit: previous?.limit,
      previousSpent:
        previous && lastSpending ? spentFor(previous.categoryId, lastSpending, childrenOf) : 0,
    });
    return {
      budget,
      rolloverAmount: rollover,
      ...budgetStatus({
        limit: budget.limit,
        spent: spentFor(budget.categoryId, spending, childrenOf),
        rollover,
        alertLevels: budget.alertLevels,
        daysLeft,
      }),
    };
  });

  return {
    month: resolvedMonth,
    fromDate: range.fromDate,
    toDate: range.toDate,
    daysLeft,
    totalSpent: spending.overall,
    budgets: items,
  };
}
