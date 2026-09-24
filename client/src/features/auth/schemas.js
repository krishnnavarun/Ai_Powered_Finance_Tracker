import { z } from 'zod';

// Same rules as the server (server/src/validators/auth.schemas.js), so most mistakes
// are caught before a request is sent. The server still checks everything.

const email = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email address'));

const utf8Bytes = (value) => new TextEncoder().encode(value).length;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .refine((value) => utf8Bytes(value) <= 72, 'Password is too long')
    .refine((value) => /[A-Za-z]/.test(value), 'Password must contain a letter')
    .refine((value) => /\d/.test(value), 'Password must contain a number'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});
