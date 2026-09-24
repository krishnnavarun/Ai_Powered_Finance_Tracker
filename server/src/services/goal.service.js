import { Goal } from '../models/Goal.js';
import { Wallet } from '../models/Wallet.js';
import { ApiError } from '../utils/ApiError.js';
import { localDateOf } from '../utils/dates.js';
import { goalProgress } from './goal.math.js';
import { findOwnedOrThrow } from './ownership.js';
import { getUserPrefs } from './userPrefs.js';

async function today(userId) {
  const { timeZone } = await getUserPrefs(userId);
  return localDateOf(new Date(), timeZone);
}

// A goal as sent to the client: the stored fields plus its progress.
function withProgress(goal, todayLocal) {
  return { ...goal.toJSON(), progress: goalProgress(goal, todayLocal) };
}

// Reaching the target marks a goal done; dropping below it again reopens it.
function syncStatus(goal) {
  if (goal.status === 'active' && goal.savedAmount >= goal.targetAmount) goal.status = 'done';
  else if (goal.status === 'done' && goal.savedAmount < goal.targetAmount) goal.status = 'active';
}

async function checkWallet(userId, walletId) {
  if (walletId) await findOwnedOrThrow(Wallet, userId, walletId, { label: 'Wallet' });
}

export async function listGoals(userId) {
  const [goals, todayLocal] = await Promise.all([
    Goal.find({ userId }).sort({ createdAt: 1 }),
    today(userId),
  ]);
  // Active goals first, then paused, then done.
  const order = { active: 0, paused: 1, done: 2 };
  return goals
    .sort((a, b) => order[a.status] - order[b.status])
    .map((goal) => withProgress(goal, todayLocal));
}

export async function createGoal(userId, data) {
  await checkWallet(userId, data.linkedWalletId);
  const goal = new Goal({ ...data, userId });
  syncStatus(goal);
  await goal.save();
  return withProgress(goal, await today(userId));
}

export async function updateGoal(userId, goalId, changes) {
  const goal = await findOwnedOrThrow(Goal, userId, goalId, { label: 'Goal' });
  if (changes.linkedWalletId) await checkWallet(userId, changes.linkedWalletId);
  goal.set(changes);
  syncStatus(goal);
  await goal.save();
  return withProgress(goal, await today(userId));
}

export async function deleteGoal(userId, goalId) {
  const goal = await findOwnedOrThrow(Goal, userId, goalId, { label: 'Goal' });
  await goal.deleteOne();
}

// Adds (or with a negative amount, takes out) money. Done in one atomic update, so two
// contributions at the same moment can't overwrite each other or go below zero.
export async function contribute(userId, goalId, { amount, date, note = '' }) {
  const todayLocal = await today(userId);
  const filter = { _id: goalId, userId };
  if (amount < 0) filter.savedAmount = { $gte: -amount };

  const goal = await Goal.findOneAndUpdate(
    filter,
    {
      $inc: { savedAmount: amount },
      $push: { contributions: { amount, date: date ?? todayLocal, note } },
    },
    { returnDocument: 'after' },
  );

  if (!goal) {
    const existing = await findOwnedOrThrow(Goal, userId, goalId, { label: 'Goal' });
    throw new ApiError(400, 'NOT_ENOUGH_SAVED', 'You can’t take out more than you have saved', {
      savedAmount: existing.savedAmount,
    });
  }

  const before = goal.status;
  syncStatus(goal);
  if (goal.status !== before) await goal.save();
  return {
    ...withProgress(goal, todayLocal),
    justCompleted: before !== 'done' && goal.status === 'done',
  };
}
