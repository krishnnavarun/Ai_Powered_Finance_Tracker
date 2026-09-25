import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Type a question').max(1000, 'Keep it under 1,000 characters'),
});
