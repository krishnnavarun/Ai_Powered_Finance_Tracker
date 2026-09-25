import { z } from 'zod';
import { SUBSCRIPTION_STATUSES } from '../models/Subscription.js';
import { objectId } from './common.js';

export const parseTextSchema = z.object({
  text: z.string().trim().min(1, 'Type something first').max(500, 'Keep it under 500 characters'),
});

export const parseSmsSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Paste at least one message')
    .max(20000, 'That is too much text; paste up to 50 messages at a time'),
});

export const receiptTextSchema = z.object({
  text: z.string().trim().min(1, 'No text was read from the photo').max(10000),
});

export const categorizeSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(['income', 'expense', 'transfer']),
        merchant: z.string().trim().max(100).optional(),
        note: z.string().trim().max(500).optional(),
      }),
    )
    .min(1)
    .max(200, 'Up to 200 at a time'),
});

export const whatIfSchema = z.object({
  changes: z
    .array(
      z.object({
        categoryId: objectId,
        changePercent: z.number().min(-100, 'Can’t cut more than 100%').max(200),
      }),
    )
    .min(1, 'Change at least one category')
    .max(20),
});

export const budgetSuggestionsQuery = z.object({
  targetSavingsRate: z.coerce.number().min(0).max(0.9).optional(),
});

export const subscriptionStatusSchema = z.object({
  status: z.enum(SUBSCRIPTION_STATUSES),
});
