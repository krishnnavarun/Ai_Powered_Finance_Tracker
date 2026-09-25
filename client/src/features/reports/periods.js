import { toLocalDate } from '@/lib/dates';

// Report periods follow the user's budget month (it may start on salary day).

function pad(n) {
  return String(n).padStart(2, '0');
}

// "2026-09" with start day 25 → { from: "2026-09-25", to: "2026-10-24" }
export function budgetMonthRange(month, startDay = 1) {
  const [year, m] = month.split('-').map(Number);
  const from = `${month}-${pad(startDay)}`;
  const next = new Date(Date.UTC(year, m, startDay)); // same day next month
  next.setUTCDate(next.getUTCDate() - 1);
  return { from, to: next.toISOString().slice(0, 10) };
}

// The budget month that today falls in → "2026-09".
export function currentBudgetMonth(today, startDay = 1) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 - (day < startDay ? 1 : 0), 1));
  return date.toISOString().slice(0, 7);
}

function shift(month, by) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 1 + by, 1)).toISOString().slice(0, 7);
}

export const PERIODS = [
  { id: 'this-month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'last-3-months', label: 'Last 3 months' },
  { id: 'this-year', label: 'This year' },
  { id: 'custom', label: 'Custom' },
];

// The from/to dates of a preset period, in the user's time zone.
export function periodRange(id, { timeZone, startDay = 1, now = new Date() } = {}) {
  const today = toLocalDate(now, timeZone);
  const current = currentBudgetMonth(today, startDay);
  switch (id) {
    case 'last-month':
      return budgetMonthRange(shift(current, -1), startDay);
    case 'last-3-months':
      return {
        from: budgetMonthRange(shift(current, -2), startDay).from,
        to: budgetMonthRange(current, startDay).to,
      };
    case 'this-year':
      return { from: `${today.slice(0, 4)}-01-01`, to: `${today.slice(0, 4)}-12-31` };
    case 'this-month':
    default:
      return budgetMonthRange(current, startDay);
  }
}
