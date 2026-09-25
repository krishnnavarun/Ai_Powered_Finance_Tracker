import { logger } from '../config/logger.js';
import { RecurringRule } from '../models/RecurringRule.js';
import { saveInsights } from '../services/insight.service.js';
import { createTransaction } from '../services/transaction.service.js';
import { getUserPrefs } from '../services/userPrefs.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, localDateOf, startOfLocalDay } from '../utils/dates.js';
import { formatINR } from '../utils/money.js';
import { nextOccurrence } from '../utils/recurrence.js';

// A daily rule missed for months shouldn't flood the account in one run.
const MAX_CATCH_UP = 62;

// Adds the transactions of recurring rules whose date has come. Missed dates (the
// worker was down) are caught up. Each date is first "claimed" by moving the rule's
// nextDate on, so two workers running at once can never add the same payment twice.
export async function runDueRecurring(now = new Date(), { limit = 500 } = {}) {
  const due = await RecurringRule.find({ active: true, nextRun: { $lte: now } })
    .sort({ nextRun: 1 })
    .limit(limit)
    .lean();

  let created = 0;
  let failed = 0;
  for (const rule of due) {
    const { timeZone } = await getUserPrefs(rule.userId);
    const today = localDateOf(now, timeZone);
    const schedule = { frequency: rule.frequency, interval: rule.interval };
    let date = rule.nextDate;

    for (let runs = 0; date && date <= today && runs < MAX_CATCH_UP; runs += 1) {
      const next = nextOccurrence(rule.startDate, schedule, addDays(date, 1), rule.endDate);
      const claimed = await RecurringRule.updateOne(
        { _id: rule._id, active: true, nextDate: date },
        {
          $set: {
            nextDate: next,
            nextRun: next ? startOfLocalDay(next, timeZone) : null,
            lastRunDate: date,
          },
        },
      );
      if (claimed.modifiedCount !== 1) break; // someone else (or an edit) got there first

      try {
        const { type, amount, walletId, toWalletId, categoryId, merchant, note } = rule.template;
        await createTransaction(String(rule.userId), {
          type,
          amount,
          walletId,
          toWalletId,
          categoryId,
          merchant,
          note,
          date,
          source: 'recurring',
          recurringId: rule._id,
        });
        created += 1;
      } catch (error) {
        failed += 1;
        logger.warn({ ruleId: String(rule._id), err: error.message }, 'recurring payment failed');
        // The wallet or category is gone or archived: stop the rule and tell the user,
        // instead of failing on every run.
        if (error instanceof ApiError && error.statusCode < 500) {
          await RecurringRule.updateOne({ _id: rule._id }, { $set: { active: false } });
          const name = rule.template.merchant || 'A recurring payment';
          await saveInsights(rule.userId, [
            {
              type: 'tip',
              severity: 'warn',
              title: `${name} was paused`,
              message: `We couldn’t add ${formatINR(rule.template.amount)} on ${date}: ${error.message} Edit the recurring payment to start it again.`,
              reason: 'The wallet or category this recurring payment uses was deleted or archived.',
              data: { ruleId: String(rule._id), date },
              dedupeKey: `recurring-failed:${rule._id}:${date}`,
            },
          ]);
          break;
        }
      }
      date = next;
    }
  }
  return { rules: due.length, created, failed };
}
