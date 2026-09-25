import bcrypt from 'bcryptjs';
import { logger } from '../config/logger.js';
import { Budget } from '../models/Budget.js';
import { Category } from '../models/Category.js';
import { ChatMessage } from '../models/ChatMessage.js';
import { ChatSession } from '../models/ChatSession.js';
import { Goal } from '../models/Goal.js';
import { Insight } from '../models/Insight.js';
import { MerchantMap } from '../models/MerchantMap.js';
import { Notification } from '../models/Notification.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Subscription } from '../models/Subscription.js';
import { Transaction } from '../models/Transaction.js';
import { User } from '../models/User.js';
import { Wallet } from '../models/Wallet.js';
import { ApiError } from '../utils/ApiError.js';
import { removeReceiptFiles } from './receipt.service.js';

// Everything that belongs to a user, by collection. (Tokens are left out of the export.)
const OWNED = {
  wallets: Wallet,
  categories: Category,
  transactions: Transaction,
  budgets: Budget,
  goals: Goal,
  recurringPayments: RecurringRule,
  subscriptions: Subscription,
  insights: Insight,
  notifications: Notification,
  merchantMemory: MerchantMap,
  chats: ChatSession,
  chatMessages: ChatMessage,
};

// A copy of all the user's data as JSON. Amounts are in paise, as stored.
// toJSON drops private fields (password hash, receipt storage keys).
export async function exportData(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account not found');
  const entries = await Promise.all(
    Object.entries(OWNED).map(async ([key, Model]) => {
      const filter = { userId };
      if (key === 'chatMessages') filter.role = { $in: ['user', 'assistant'] };
      const docs = await Model.find(filter).sort({ createdAt: 1 });
      return [key, docs.map((doc) => doc.toJSON())];
    }),
  );
  return {
    exportedAt: new Date().toISOString(),
    note: 'Amounts are in paise (₹1 = 100 paise).',
    user: user.toJSON(),
    ...Object.fromEntries(entries),
  };
}

// Deletes the account and every piece of data in it, after checking the password.
export async function deleteAccount(userId, password) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Account not found');
  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new ApiError(400, 'WRONG_PASSWORD', 'That password is not right');
  }

  await purgeUser(user);
  logger.info({ userId: String(userId) }, 'account deleted');
}

// Removes a user and everything they own (also used to clear old demo accounts).
export async function purgeUser(user) {
  const userId = user._id;
  const receiptKeys = await Transaction.distinct('receiptKey', {
    userId,
    receiptKey: { $ne: null },
  });
  await Promise.all([
    ...Object.values(OWNED).map((Model) => Model.deleteMany({ userId })),
    RefreshToken.deleteMany({ userId }),
  ]);
  await User.deleteOne({ _id: userId });
  await removeReceiptFiles(receiptKeys);
}
