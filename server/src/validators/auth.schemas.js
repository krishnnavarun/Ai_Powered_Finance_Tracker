import { z } from 'zod';

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long')
  .pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes of a password, so longer ones are rejected
// rather than silently truncated.
export const newPassword = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long')
  .refine((value) => /[A-Za-z]/.test(value), 'Password must contain a letter')
  .refine((value) => /\d/.test(value), 'Password must contain a number');

export const registerSchema = z.object({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(80, 'Name is too long'),
  email,
  password: newPassword,
});

// No strength rules on login — only on creating a password.
export const loginSchema = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(200),
});
