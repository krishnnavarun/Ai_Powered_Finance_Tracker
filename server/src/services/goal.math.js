// Pure goal calculations (no database), so they are easy to test.

// Whole months from one local date to another, counting a started month as a month:
// 24 Sep → 31 Dec = 4 (Sep, Oct, Nov, Dec left to save in). Never less than 1.
export function monthsUntil(todayLocal, deadlineLocal) {
  const [y1, m1] = todayLocal.split('-').map(Number);
  const [y2, m2] = deadlineLocal.split('-').map(Number);
  return Math.max(1, (y2 - y1) * 12 + (m2 - m1) + 1);
}

// Progress of a goal and what it takes to finish on time.
//   targetAmount, savedAmount: paise · deadline: local date or null · today: local date
export function goalProgress({ targetAmount, savedAmount, deadline, status }, today) {
  const remaining = Math.max(0, targetAmount - savedAmount);
  const percent =
    targetAmount > 0 ? Math.min(100, Math.floor((savedAmount / targetAmount) * 100)) : 0;

  const result = { percent, remaining, monthsLeft: null, requiredPerMonth: null, overdue: false };
  if (!deadline || remaining === 0 || status !== 'active') return result;

  if (deadline < today) return { ...result, overdue: true };
  const monthsLeft = monthsUntil(today, deadline);
  return { ...result, monthsLeft, requiredPerMonth: Math.ceil(remaining / monthsLeft) };
}
