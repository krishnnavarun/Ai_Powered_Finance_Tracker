import { logger } from '../config/logger.js';
import { Budget } from '../models/Budget.js';
import { Category } from '../models/Category.js';
import { User } from '../models/User.js';
import { budgetStatusFor } from '../services/budget.service.js';
import { saveInsights } from '../services/insight.service.js';
import { formatINR } from '../utils/money.js';

// Warns once per budget and level (80%, 100%…) when spending crosses it. `alertsSent`
// on the budget records what was sent, so a level never fires twice in a month.
export async function budgetAlertsForUser(userId) {
  const status = await budgetStatusFor(userId);
  const categories = await Category.find({ userId }).select('name').lean();
  const nameOf = (id) =>
    id ? (categories.find((c) => String(c._id) === String(id))?.name ?? 'Budget') : 'Overall';

  let sent = 0;
  for (const item of status.budgets) {
    const { budget, spent, effectiveLimit } = item;
    // Highest level crossed first, so jumping past 80% and 100% at once says "over".
    const crossed = [...budget.alertLevels]
      .sort((a, b) => b - a)
      .filter(
        (level) => spent * 100 >= effectiveLimit * level && !budget.alertsSent.includes(level),
      );
    for (const level of crossed) {
      const claimed = await Budget.updateOne(
        { _id: budget._id, alertsSent: { $ne: level } },
        { $addToSet: { alertsSent: level } },
      );
      if (claimed.modifiedCount !== 1) continue;
      // Only the highest newly crossed level becomes a message; lower ones are just marked.
      if (level !== crossed[0]) continue;

      const name = nameOf(budget.categoryId);
      const percent = Math.floor((spent / effectiveLimit) * 100);
      sent += await saveInsights(userId, [
        {
          type: 'budget',
          severity: level >= 100 ? 'critical' : 'warn',
          title:
            level >= 100 ? `${name} budget is used up` : `${percent}% of your ${name} budget used`,
          message:
            `You’ve spent ${formatINR(spent)} of ${formatINR(effectiveLimit)}` +
            (status.daysLeft > 0 ? ` with ${status.daysLeft} days left this month.` : '.'),
          reason: `Budget ${formatINR(effectiveLimit)} for ${status.fromDate} to ${status.toDate}; spent ${formatINR(spent)} so far (${percent}%). You asked to be told at ${level}%.`,
          data: {
            budgetId: String(budget._id),
            categoryId: budget.categoryId ? String(budget.categoryId) : null,
            month: status.month,
            spent,
            limit: effectiveLimit,
            level,
          },
          dedupeKey: `budget:${budget._id}:${level}`,
        },
      ]);
    }
  }
  return sent;
}

// Every user who has budgets and hasn't turned budget alerts off.
export async function runBudgetAlerts() {
  const withBudgets = await Budget.distinct('userId');
  const users = await User.find({
    _id: { $in: withBudgets },
    'settings.budgetAlerts': { $ne: false },
  })
    .select('_id')
    .lean();

  let sent = 0;
  for (const { _id } of users) {
    try {
      sent += await budgetAlertsForUser(String(_id));
    } catch (error) {
      logger.warn({ userId: String(_id), err: error.message }, 'budget alerts failed');
    }
  }
  return { users: users.length, sent };
}
