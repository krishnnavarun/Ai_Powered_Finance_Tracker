import { addDays, addMonths } from './dates.js';

export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'];

// The n-th date (0 = the start date) of a repeating schedule, as a local date.
// Always counted from the start date, never from the previous date, so a rule that
// starts on the 31st gives 28 Feb and then 31 Mar again (no drift to the 28th).
export function occurrence(startDate, { frequency, interval = 1 }, n) {
  const steps = n * interval;
  switch (frequency) {
    case 'daily':
      return addDays(startDate, steps);
    case 'weekly':
      return addDays(startDate, steps * 7);
    case 'monthly':
      return addMonths(startDate, steps, Number(startDate.slice(8, 10)));
    case 'yearly':
      return addMonths(startDate, steps * 12, Number(startDate.slice(8, 10)));
    default:
      throw new Error(`Unknown frequency: ${frequency}`);
  }
}

// Rough number of days between occurrences, to jump close to a far-away date quickly.
const APPROX_DAYS = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };

// The first date of the schedule on or after `fromDate`, or null once past `endDate`.
export function nextOccurrence(startDate, schedule, fromDate, endDate = null) {
  if (fromDate <= startDate) {
    return endDate && startDate > endDate ? null : startDate;
  }
  const gapDays = (Date.parse(fromDate) - Date.parse(startDate)) / 86_400_000;
  let n = Math.max(
    0,
    Math.floor(gapDays / (APPROX_DAYS[schedule.frequency] * (schedule.interval ?? 1))) - 1,
  );
  let date = occurrence(startDate, schedule, n);
  while (date < fromDate) {
    n += 1;
    date = occurrence(startDate, schedule, n);
  }
  return endDate && date > endDate ? null : date;
}

// The next `count` dates on or after `fromDate` (for "coming up" previews).
export function upcomingOccurrences(startDate, schedule, fromDate, count, endDate = null) {
  const dates = [];
  let from = fromDate;
  while (dates.length < count) {
    const next = nextOccurrence(startDate, schedule, from, endDate);
    if (!next) break;
    dates.push(next);
    from = addDays(next, 1);
  }
  return dates;
}
