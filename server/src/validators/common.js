import { z } from 'zod';

// MongoDB ObjectId as a 24-character hex string.
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

export const idParams = z.object({ id: objectId });

// Largest amount accepted anywhere: ₹10,000 crore, far beyond any personal account.
const MAX_PAISE = 10_000_000_000_000;

// Amount in paise (integer). The client converts ₹ → paise before sending.
export const paise = z
  .int('Amount must be a whole number of paise')
  .min(-MAX_PAISE, 'Amount is too large')
  .max(MAX_PAISE, 'Amount is too large');

export const positivePaise = paise.positive('Amount must be greater than zero');

// Lucide icon name, e.g. "utensils" or "shopping-basket".
export const iconName = z.string().regex(/^[a-z0-9-]{1,40}$/, 'Invalid icon name');

// "#0f766e"
export const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Colour must look like #1a2b3c');

// Query-string booleans arrive as text: "true" / "false".
export const queryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();

// Rejects an empty PATCH body instead of silently doing nothing.
export function nonEmptyPatch(schema) {
  return schema.partial().refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update',
  });
}
