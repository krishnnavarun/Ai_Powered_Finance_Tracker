import { z } from 'zod';
import { COLUMNS } from '../ai/parsers/csvImporter.js';
import { objectId, positivePaise } from './common.js';

const column = z.int().min(0).max(500).nullable();

const chosenMapping = z.object({
  headerIndex: z.int().min(0).max(1000),
  mapping: z.object(Object.fromEntries(COLUMNS.map((name) => [name, column]))),
});

// Multipart text field "mapping": JSON with the columns the user picked (optional).
export const previewCsvSchema = z.object({
  mapping: z
    .string()
    .optional()
    .transform((text, ctx) => {
      if (!text) return undefined;
      try {
        return JSON.parse(text);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid column choice' });
        return z.NEVER;
      }
    })
    .pipe(chosenMapping.optional()),
});

export const MAX_IMPORT_ROWS = 2000;

export const commitCsvSchema = z.object({
  walletId: objectId,
  // true: the wallet balance already includes these payments (see importTransactions).
  keepBalance: z.boolean().default(true),
  rows: z
    .array(
      z.object({
        date: z.iso.date(),
        type: z.enum(['income', 'expense']),
        amount: positivePaise,
        categoryId: objectId.nullable().optional(),
        merchant: z.string().trim().max(100).optional(),
        note: z.string().trim().max(500).optional(),
        aiConfidence: z.number().min(0).max(1).nullable().optional(),
      }),
    )
    .min(1, 'Choose at least one row')
    .max(MAX_IMPORT_ROWS, `Import up to ${MAX_IMPORT_ROWS} rows at a time`),
});
