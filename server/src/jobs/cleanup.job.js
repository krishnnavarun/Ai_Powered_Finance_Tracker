import { logger } from '../config/logger.js';
import { User } from '../models/User.js';
import { DEMO_EMAIL_PATTERN } from '../seed/demoUser.js';
import { purgeUser } from '../services/account.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

// Demo accounts live for a day, then everything in them is removed.
export async function removeOldDemoAccounts(now = new Date()) {
  const old = await User.find({
    email: DEMO_EMAIL_PATTERN,
    createdAt: { $lt: new Date(now.getTime() - DAY_MS) },
  })
    .select('_id')
    .lean();
  for (const user of old) {
    try {
      await purgeUser(user);
    } catch (error) {
      logger.warn({ userId: String(user._id), err: error.message }, 'demo cleanup failed');
    }
  }
  return { removed: old.length };
}
