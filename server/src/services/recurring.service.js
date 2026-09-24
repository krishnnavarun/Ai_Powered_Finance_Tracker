import { RecurringRule } from '../models/RecurringRule.js';
import { addDays, localDateOf, startOfLocalDay } from '../utils/dates.js';
import { nextOccurrence, upcomingOccurrences } from '../utils/recurrence.js';
import { findOwnedOrThrow } from './ownership.js';
import { resolveTransaction } from './transaction.service.js';
import { getUserPrefs } from './userPrefs.js';

const SCHEDULE_FIELDS = ['frequency', 'interval', 'startDate', 'endDate', 'active'];

// The template must be a valid transaction (own wallets, matching category type,
// transfers between two different wallets…) — the same rules as a real one.
async function cleanTemplate(userId, template) {
  const { toWalletId, categoryId, merchant, note, type, amount, walletId } =
    await resolveTransaction(userId, {
      merchant: '',
      note: '',
      categoryId: null,
      toWalletId: null,
      ...template,
    });
  return { type, amount, walletId, toWalletId, categoryId, merchant, note };
}

const scheduleOf = (rule) => ({ frequency: rule.frequency, interval: rule.interval });

// Works out when the rule runs next: never before today (a start date in the past
// doesn't create back-dated transactions) and never a date that already ran.
function schedule(rule, { timeZone, todayLocal }) {
  let from = todayLocal;
  if (rule.lastRunDate && rule.lastRunDate >= from) from = addDays(rule.lastRunDate, 1);

  const next = rule.active
    ? nextOccurrence(rule.startDate, scheduleOf(rule), from, rule.endDate)
    : null;
  rule.nextDate = next;
  rule.nextRun = next ? startOfLocalDay(next, timeZone) : null;
}

// The next three dates, for a "coming up" preview. Counted from the start date, so a
// rule on the 31st shows 28 Feb, 31 Mar, 30 Apr (not 28 Feb, 28 Mar, 28 Apr).
function withUpcoming(rule) {
  const upcoming = rule.nextDate
    ? upcomingOccurrences(rule.startDate, scheduleOf(rule), rule.nextDate, 3, rule.endDate)
    : [];
  return { ...rule.toJSON(), upcoming };
}

async function context(userId) {
  const { timeZone } = await getUserPrefs(userId);
  return { timeZone, todayLocal: localDateOf(new Date(), timeZone) };
}

export async function listRules(userId) {
  const rules = await RecurringRule.find({ userId }).sort({ active: -1, nextRun: 1, createdAt: 1 });
  return rules.map(withUpcoming);
}

export async function createRule(userId, data) {
  const ctx = await context(userId);
  const rule = new RecurringRule({
    ...data,
    userId,
    interval: data.interval ?? 1,
    template: await cleanTemplate(userId, data.template),
  });
  schedule(rule, ctx);
  await rule.save();
  return withUpcoming(rule);
}

export async function updateRule(userId, ruleId, changes) {
  const ctx = await context(userId);
  const rule = await findOwnedOrThrow(RecurringRule, userId, ruleId, {
    label: 'Recurring payment',
  });
  const { template, ...rest } = changes;
  if (template) rule.template = await cleanTemplate(userId, template);
  rule.set(rest);
  if (SCHEDULE_FIELDS.some((field) => field in rest)) schedule(rule, ctx);
  await rule.save();
  return withUpcoming(rule);
}

export async function deleteRule(userId, ruleId) {
  const rule = await findOwnedOrThrow(RecurringRule, userId, ruleId, {
    label: 'Recurring payment',
  });
  await rule.deleteOne();
}
