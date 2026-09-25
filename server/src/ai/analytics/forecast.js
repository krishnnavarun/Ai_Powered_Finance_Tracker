import { addDays, daysBetween } from '../../utils/dates.js';

export const EMA_ALPHA = 0.3;

// Exponential moving average of daily spending: recent days count more.
// `seed` is where the average starts (e.g. last months' daily average), so one big
// day early in the month doesn't dominate.
export function emaDaily(values, { alpha = EMA_ALPHA, seed } = {}) {
  if (!values.length) return seed ?? 0;
  let ema = seed ?? values[0];
  for (const value of seed === undefined ? values.slice(1) : values) {
    ema = alpha * value + (1 - alpha) * ema;
  }
  return ema;
}

// Predicts the total balance at the end of the budget month.
//
//   today, monthEnd       local dates ("2026-09-24", "2026-09-30")
//   monthStart            first day of the budget month
//   balance               total balance now (paise)
//   days                  [{ date, income, expense, recurringExpense }] for this month so far
//                         (recurringExpense = the part added by recurring rules; it is left
//                         out of the daily average because it's counted as "upcoming")
//   seedDaily             average daily spend of recent months, or null
//   upcoming              [{ date, type, amount }] recurring payments still to come this month
//   budgets               [{ categoryId, limit, spent }] to project to month end
//
// predictedEnd = balance − averageDaily × daysLeft − upcoming spending + upcoming income
export function forecastMonthEnd({
  today,
  monthStart,
  monthEnd,
  balance,
  days,
  seedDaily = null,
  upcoming = [],
  budgets = [],
}) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const elapsed = daysBetween(monthStart, today) + 1; // today counts as spent
  const daysLeft = Math.max(0, daysBetween(today, monthEnd));

  // Every day so far, zero-spend days included.
  const dailySpend = [];
  for (let i = 0; i < elapsed; i += 1) {
    const day = byDate.get(addDays(monthStart, i));
    dailySpend.push(day ? Math.max(0, day.expense - (day.recurringExpense ?? 0)) : 0);
  }
  const averageDaily = Math.round(emaDaily(dailySpend, { seed: seedDaily ?? undefined }));

  const upcomingExpense = upcoming
    .filter((item) => item.type === 'expense')
    .reduce((total, item) => total + item.amount, 0);
  const upcomingIncome = upcoming
    .filter((item) => item.type === 'income')
    .reduce((total, item) => total + item.amount, 0);
  const predictedEnd = balance - averageDaily * daysLeft - upcomingExpense + upcomingIncome;

  // Balance at the end of each day: past days worked back from today's balance,
  // future days stepped forward with the average and the known recurring payments.
  const series = [];
  let running = balance;
  for (let i = elapsed - 1; i >= 0; i -= 1) {
    const date = addDays(monthStart, i);
    series.unshift({ date, actual: running });
    const day = byDate.get(date);
    if (day) running -= day.income - day.expense;
  }
  running = balance;
  series[series.length - 1].predicted = balance; // the lines meet at today
  for (let i = 1; i <= daysLeft; i += 1) {
    const date = addDays(today, i);
    running -= averageDaily;
    for (const item of upcoming.filter((u) => u.date === date)) {
      running += item.type === 'income' ? item.amount : -item.amount;
    }
    series.push({ date, predicted: running });
  }

  // Low = less than a week of normal spending left at month end.
  let warning = null;
  if (predictedEnd < 0) warning = 'negative';
  else if (predictedEnd < averageDaily * 7) warning = 'low';

  const totalDays = elapsed + daysLeft;
  return {
    predictedEnd,
    balance,
    averageDaily,
    daysLeft,
    upcomingExpense,
    upcomingIncome,
    warning,
    series,
    // Each budget at today's pace: spent so far, stretched over the whole month.
    budgets: budgets.map(({ categoryId, limit, spent }) => {
      const projected = Math.round((spent / elapsed) * totalDays);
      return { categoryId, limit, spent, projected, willExceed: projected > limit };
    }),
  };
}
