import { ordinal } from '@/lib/dates';

export const FREQUENCIES = [
  { value: 'daily', label: 'Day', plural: 'days' },
  { value: 'weekly', label: 'Week', plural: 'weeks' },
  { value: 'monthly', label: 'Month', plural: 'months' },
  { value: 'yearly', label: 'Year', plural: 'years' },
];

// A local date "2026-09-24" read as a calendar day (no time zone shifts).
function calendarDay(localDate) {
  return new Date(`${localDate}T00:00:00Z`);
}

function weekday(localDate) {
  return calendarDay(localDate).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

function dayAndMonth(localDate) {
  return calendarDay(localDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

// "Every month on the 1st", "Every 2 weeks on Monday", "Every year on 5 March", "Every day".
export function describeSchedule({ frequency, interval = 1, startDate }) {
  const unit = FREQUENCIES.find((f) => f.value === frequency);
  const every =
    interval === 1 ? `Every ${unit.label.toLowerCase()}` : `Every ${interval} ${unit.plural}`;
  const day = Number(startDate.slice(8, 10));
  if (frequency === 'weekly') return `${every} on ${weekday(startDate)}`;
  if (frequency === 'monthly') {
    // Rules on the 29th–31st fall on the last day in shorter months.
    return `${every} on the ${ordinal(day)}${day > 28 ? ' (or the last day)' : ''}`;
  }
  if (frequency === 'yearly') return `${every} on ${dayAndMonth(startDate)}`;
  return every;
}

// Average times a rule runs in one month.
const PER_MONTH = { daily: 365.25 / 12, weekly: 365.25 / 12 / 7, monthly: 1, yearly: 1 / 12 };

// About how much a rule adds up to in an average month, in paise.
export function monthlyAmount({ template, frequency, interval = 1 }) {
  return Math.round((template.amount * PER_MONTH[frequency]) / interval);
}

// Totals of active rules per month: { income, expense }. Transfers only move money.
export function monthlyTotals(rules) {
  const totals = { income: 0, expense: 0 };
  for (const rule of rules) {
    if (rule.active && rule.nextDate && rule.template.type !== 'transfer') {
      totals[rule.template.type] += monthlyAmount(rule);
    }
  }
  return totals;
}

// A readable name for a rule: its merchant, else category, else note, else the type.
export function ruleName(rule, { category, toWallet }) {
  const t = rule.template;
  if (t.type === 'transfer') return t.note || `Move to ${toWallet?.name ?? 'another wallet'}`;
  return t.merchant || category?.name || t.note || (t.type === 'income' ? 'Income' : 'Payment');
}
