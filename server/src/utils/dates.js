// Date helpers that respect the user's time zone (default Asia/Kolkata).
// A "local date" is a calendar day string like "2026-09-24".

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value) {
  return typeof value === 'string' && DATE_ONLY.test(value);
}

// Minutes the time zone is ahead of UTC at a given moment, e.g. Asia/Kolkata → 330.
export function timeZoneOffsetMinutes(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  const wallClockAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((wallClockAsUtc - instant.getTime()) / 60_000);
}

// The instant a local day begins: ("2026-09-24", "Asia/Kolkata") → 2026-09-23T18:30:00Z.
export function startOfLocalDay(localDate, timeZone) {
  const [year, month, day] = localDate.split('-').map(Number);
  const midnightUtc = Date.UTC(year, month - 1, day);
  let offset = timeZoneOffsetMinutes(new Date(midnightUtc), timeZone);
  // Near a daylight-saving change the offset at the result can differ; check once more.
  const corrected = timeZoneOffsetMinutes(new Date(midnightUtc - offset * 60_000), timeZone);
  if (corrected !== offset) offset = corrected;
  return new Date(midnightUtc - offset * 60_000);
}

// "2026-09-30" + 1 → "2026-10-01"
export function addDays(localDate, days) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// Accepts a local date ("2026-09-24" → start of that day in the user's zone) or a full
// ISO timestamp with an offset (kept exactly).
export function toInstant(value, timeZone) {
  return isLocalDate(value) ? startOfLocalDay(value, timeZone) : new Date(value);
}

// The calendar day of an instant in a time zone → "2026-09-24".
// (The en-CA locale formats dates as YYYY-MM-DD.)
export function localDateOf(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate(); // month is 1-12
}

// Adds whole months, keeping the day but clamping it to the month's length:
// ("2026-01-31", 1) → "2026-02-28". Pass `anchorDay` to aim for a day other than the
// start date's own, e.g. monthly rent on the 31st.
export function addMonths(localDate, months, anchorDay) {
  const [year, month, day] = localDate.split('-').map(Number);
  const total = year * 12 + (month - 1) + months;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  const newDay = Math.min(anchorDay ?? day, daysInMonth(newYear, newMonth));
  return `${newYear}-${String(newMonth).padStart(2, '0')}-${String(newDay).padStart(2, '0')}`;
}

// Whole days from one local date to another: ("2026-09-01", "2026-09-30") → 29.
export function daysBetween(fromLocal, toLocal) {
  return Math.round(
    (Date.parse(`${toLocal}T00:00:00Z`) - Date.parse(`${fromLocal}T00:00:00Z`)) / 86_400_000,
  );
}

// ---- The user's "month" -------------------------------------------------------------
// A budget month can start on any day 1–28 (e.g. salary day). "2026-09" with
// monthStartDay 25 means 25 Sep → 24 Oct.

// The first and last local day of a budget month, plus the instants for querying
// (`start` inclusive, `end` exclusive).
export function monthRange(month, { monthStartDay = 1, timeZone }) {
  const fromDate = `${month}-${String(monthStartDay).padStart(2, '0')}`;
  const nextStart = addMonths(fromDate, 1);
  return {
    fromDate,
    toDate: addDays(nextStart, -1),
    start: startOfLocalDay(fromDate, timeZone),
    end: startOfLocalDay(nextStart, timeZone),
  };
}

// The budget month that contains a given moment → "2026-09".
export function monthContaining(instant, { monthStartDay = 1, timeZone }) {
  const today = localDateOf(instant, timeZone);
  const day = Number(today.slice(8, 10));
  const month = today.slice(0, 7);
  return day >= monthStartDay ? month : addMonths(`${month}-01`, -1).slice(0, 7);
}

// "2026-09" → "2026-08"
export function previousMonth(month) {
  return addMonths(`${month}-01`, -1).slice(0, 7);
}
