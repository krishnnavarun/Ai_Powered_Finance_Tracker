export const MONTH_START_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

const COMMON_TIME_ZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];

// The browser's own time zone, or India if it can't be read.
export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

// Common zones plus the user's current and detected ones, without repeats.
export function timeZoneOptions(...extra) {
  return [...new Set([...extra.filter(Boolean), ...COMMON_TIME_ZONES])];
}
