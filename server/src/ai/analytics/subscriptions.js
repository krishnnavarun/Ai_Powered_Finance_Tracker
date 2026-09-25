import { addDays, addMonths, daysBetween } from '../../utils/dates.js';
import { mean, median } from './stats.js';

// A charge repeating about every week, month or year, allowing a few days' drift.
export const PERIODS = [
  { name: 'weekly', days: 7, tolerance: 3, perYear: 52 },
  { name: 'monthly', days: 30, tolerance: 5, perYear: 12 },
  { name: 'yearly', days: 365, tolerance: 15, perYear: 1 },
];
const MIN_CHARGES = 3;
const MAX_AMOUNT_SPREAD = 0.1; // every charge within 10% of the usual amount

function nextDate(last, period) {
  if (period.name === 'weekly') return addDays(last, 7);
  if (period.name === 'monthly') return addMonths(last, 1);
  return addMonths(last, 12);
}

// Finds payments that look like subscriptions.
//   charges: [{ merchantKey, merchant, amount, date (local "YYYY-MM-DD") }] (expenses)
//   today:   local date, to tell whether a subscription is still going
// → [{ merchantKey, displayName, avgAmount, period, periodDays, chargeCount,
//      lastChargedAt, nextExpectedAt, yearlyCost, late }]
export function detectSubscriptions(charges, { today }) {
  const byMerchant = new Map();
  for (const charge of charges) {
    if (!charge.merchantKey) continue;
    if (!byMerchant.has(charge.merchantKey)) byMerchant.set(charge.merchantKey, []);
    byMerchant.get(charge.merchantKey).push(charge);
  }

  const found = [];
  for (const [merchantKey, list] of byMerchant) {
    if (list.length < MIN_CHARGES) continue;
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));

    const amounts = sorted.map((c) => c.amount);
    const usual = median(amounts);
    if (amounts.some((amount) => Math.abs(amount - usual) > usual * MAX_AMOUNT_SPREAD)) continue;

    const gaps = sorted.slice(1).map((c, i) => daysBetween(sorted[i].date, c.date));
    const period = PERIODS.find((p) => gaps.every((gap) => Math.abs(gap - p.days) <= p.tolerance));
    if (!period) continue;

    const last = sorted.at(-1);
    const avgAmount = Math.round(mean(amounts));
    const nextExpectedAt = nextDate(last.date, period);
    found.push({
      merchantKey,
      displayName: last.merchant || merchantKey,
      avgAmount,
      period: period.name,
      periodDays: period.days,
      chargeCount: sorted.length,
      lastChargedAt: last.date,
      nextExpectedAt,
      yearlyCost: avgAmount * period.perYear,
      // Missed its date by more than the drift allowed: maybe already cancelled.
      late: daysBetween(nextExpectedAt, today) > period.tolerance,
    });
  }
  return found.sort((a, b) => b.yearlyCost - a.yearlyCost);
}
