import { z } from 'zod';
import { nonEmptyPatch } from './common.js';

// Only rupees for now; multi-currency is on the roadmap (Section 13).
export const CURRENCIES = ['INR'];

// Accepts any IANA time zone the server knows, e.g. "Asia/Kolkata" or "Europe/London".
const timeZone = z
  .string()
  .max(64)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Unknown time zone');

export const updateProfileSchema = nonEmptyPatch(
  z.object({
    name: z.string().trim().min(1, 'Please enter your name').max(80, 'Name is too long'),
    currency: z.enum(CURRENCIES, 'Only INR is supported for now'),
    // Capped at 28 so the day exists in every month.
    monthStartDay: z.int().min(1, 'Pick a day from 1 to 28').max(28, 'Pick a day from 1 to 28'),
    timezone: timeZone,
    onboardingDone: z.boolean(),
  }),
);

export const updateSettingsSchema = nonEmptyPatch(
  z.object({
    aiEnabled: z.boolean(),
    digestEmail: z.boolean(),
    budgetAlerts: z.boolean(),
    theme: z.enum(['light', 'dark', 'system']),
  }),
);

export const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Enter your password to confirm').max(200),
});
