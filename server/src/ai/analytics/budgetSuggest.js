import { median, roundUpToHundredRupees } from './stats.js';

// Which default categories are needs (hard to cut) and which are wants. Everything
// else, including custom categories, counts as a want. Investments are saving, not
// spending, so they are never cut.
const NEEDS = new Set([
  'rent',
  'utilities',
  'groceries',
  'mobile_internet',
  'health',
  'education',
  'emi_loans',
  'transport',
  'fuel',
]);
const NEVER_CUT = new Set(['investments']);

const MAX_WANT_CUT = 0.3; // wants can shrink by up to 30%
const MAX_NEED_CUT = 0.1; // needs by up to 10%

// Suggests a monthly budget per category.
//   categories:  [{ categoryId, systemKey, months: [spent in each of the last 3 months] }]
//   income:      average monthly income (paise; 0 if unknown)
//   targetSavingsRate: part of income to keep (default 20%)
// Each budget starts at the median month, then wants (and if needed, needs) are
// trimmed so spending fits in income × (1 − target). Rounded up to whole ₹100.
export function suggestBudgets({ categories, income, targetSavingsRate = 0.2 }) {
  const rows = categories
    .map(({ categoryId, systemKey, months }) => ({
      categoryId,
      kind: NEVER_CUT.has(systemKey) ? 'saving' : NEEDS.has(systemKey) ? 'need' : 'want',
      median: Math.round(median(months)),
    }))
    .filter((row) => row.median > 0);

  const total = rows.reduce((sum, row) => sum + row.median, 0);
  const allowed = income > 0 ? Math.round(income * (1 - targetSavingsRate)) : null;
  let over = allowed === null ? 0 : Math.max(0, total - allowed);

  const cuts = new Map(rows.map((row) => [row.categoryId, 0]));
  for (const [kind, maxCut] of [
    ['want', MAX_WANT_CUT],
    ['need', MAX_NEED_CUT],
  ]) {
    if (over <= 0) break;
    const group = rows.filter((row) => row.kind === kind);
    const room = group.reduce((sum, row) => sum + row.median * maxCut, 0);
    if (room <= 0) continue;
    // Everyone in the group gives up the same share of what they can give.
    const share = Math.min(1, over / room);
    for (const row of group) {
      const cut = Math.round(row.median * maxCut * share);
      cuts.set(row.categoryId, cut);
      over -= cut;
    }
  }

  const suggestions = rows.map((row) => {
    const cut = cuts.get(row.categoryId);
    return {
      categoryId: row.categoryId,
      kind: row.kind,
      median: row.median,
      suggested: roundUpToHundredRupees(row.median - cut),
      trimmedBy: cut,
    };
  });
  const suggestedTotal = suggestions.reduce((sum, s) => sum + s.suggested, 0);
  return {
    suggestions: suggestions.sort((a, b) => b.suggested - a.suggested),
    income,
    targetSavingsRate,
    medianTotal: total,
    suggestedTotal,
    // What would be saved each month on these budgets (null without income).
    projectedSavingsRate:
      income > 0 ? Math.round(((income - suggestedTotal) / income) * 100) : null,
    // Even after the biggest cuts, spending may not fit the target.
    reachesTarget: allowed === null ? null : suggestedTotal <= allowed + rows.length * 10000,
  };
}
