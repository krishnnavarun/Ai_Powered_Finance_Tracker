import { mean, std } from './stats.js';

export const Z_LIMIT = 2;
export const MIN_AMOUNT = 50000; // ₹500: smaller jumps aren't worth a warning
const MIN_HISTORY_WEEKS = 3; // weeks with some spending, before a category can be judged

// Categories where this week's spending is far above normal.
//   categories: [{ categoryId, history: [8 earlier weekly totals], thisWeek }]
// Flags z = (thisWeek − mean) / std above 2 and more than ₹500 this week. When past
// weeks were all the same (std 0), a jump of ₹500+ and double the usual counts instead.
export function spendingAnomalies(categories) {
  const flagged = [];
  for (const { categoryId, history, thisWeek } of categories) {
    if (thisWeek <= MIN_AMOUNT) continue;
    if (history.filter((week) => week > 0).length < MIN_HISTORY_WEEKS) continue;

    const average = mean(history);
    const spread = std(history);
    const z = spread > 0 ? (thisWeek - average) / spread : null;
    const unusual =
      z === null ? thisWeek - average >= MIN_AMOUNT && thisWeek >= average * 2 : z > Z_LIMIT;
    if (unusual) {
      flagged.push({
        categoryId,
        thisWeek,
        average: Math.round(average),
        std: Math.round(spread),
        z: z === null ? null : Math.round(z * 10) / 10,
        history,
      });
    }
  }
  return flagged.sort((a, b) => b.thisWeek - b.average - (a.thisWeek - a.average));
}

const DAY_MS = 24 * 60 * 60 * 1000;

// The same merchant charging the same amount twice within 24 hours.
//   transactions: [{ id, merchantKey, merchant?, amount, date (Date), type }]
export function duplicateCharges(transactions) {
  const expenses = transactions
    .filter((t) => t.type === 'expense' && t.merchantKey)
    .sort((a, b) => a.date - b.date);
  const pairs = [];
  expenses.forEach((first, i) => {
    for (const second of expenses.slice(i + 1)) {
      const gap = second.date - first.date;
      if (gap > DAY_MS) break;
      if (second.merchantKey === first.merchantKey && second.amount === first.amount) {
        pairs.push({
          ids: [first.id, second.id],
          merchantKey: first.merchantKey,
          merchant: first.merchant || first.merchantKey,
          amount: first.amount,
          hoursApart: Math.round((gap / 3_600_000) * 10) / 10,
        });
      }
    }
  });
  return pairs;
}
