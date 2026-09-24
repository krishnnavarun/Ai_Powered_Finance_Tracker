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
