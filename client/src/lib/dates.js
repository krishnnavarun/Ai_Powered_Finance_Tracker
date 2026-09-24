import { useAuthStore } from '@/store/auth';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

// The logged-in user's time zone (falls back to India).
export function useTimeZone() {
  return useAuthStore((state) => state.user?.timezone ?? DEFAULT_TIME_ZONE);
}

// The calendar day of an instant in a time zone: → "2026-09-24".
// (The en-CA locale happens to format dates as YYYY-MM-DD.)
export function toLocalDate(instant = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

// "2026-09-23T18:30:00Z" → "24 Sep 2026" (in India).
export function formatDate(instant, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(instant));
}

// "2026-09-24" → "2026-09-01"
export function startOfMonth(localDate) {
  return `${localDate.slice(0, 8)}01`;
}
