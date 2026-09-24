// Pure budget calculations (no database), so they are easy to test.

// Money left over from last month that carries into this one (when the budget has
// rollover on and last month had a budget too). Only savings carry over; overspending
// last month doesn't shrink this month's budget.
export function rolloverAmount({ enabled, previousLimit, previousSpent }) {
  if (!enabled || previousLimit === undefined) return 0;
  return Math.max(0, previousLimit - previousSpent);
}

// Status of one budget for its month.
//   limit, spent, rollover: paise · alertLevels: e.g. [80, 100] · daysLeft: days left
//   in the month including today (0 once the month is over).
export function budgetStatus({ limit, spent, rollover = 0, alertLevels = [80, 100], daysLeft }) {
  const effectiveLimit = limit + rollover;
  const remaining = effectiveLimit - spent;
  // Rounded down for display, so "100%" never shows before the limit is really reached.
  const percent = effectiveLimit > 0 ? Math.floor((spent / effectiveLimit) * 100) : 0;
  const warnAt = Math.min(...alertLevels);

  // Status compares exact amounts (no rounding): ₹7,999.99 of ₹10,000 is not yet 80%.
  let status = 'ok';
  if (spent >= effectiveLimit) status = 'over';
  else if (spent * 100 >= effectiveLimit * warnAt) status = 'warning';

  return {
    effectiveLimit,
    spent,
    remaining,
    percent,
    status,
    // How much can still be spent per day without going over.
    dailyAllowance: daysLeft > 0 && remaining > 0 ? Math.floor(remaining / daysLeft) : 0,
  };
}
