import { z } from 'zod';
import { TRANSACTION_SOURCES, TRANSACTION_TYPES } from '../models/Transaction.js';
import { nonEmptyPatch, objectId, paise, positivePaise } from './common.js';

const EARLIEST = Date.parse('2000-01-01T00:00:00Z');
const ONE_YEAR_MS = 366 * 24 * 60 * 60 * 1000;

// "2026-09-24" (a day in the user's time zone) or a full ISO timestamp with offset.
const localDate = z.iso.date('Use a date like 2026-09-24');
export const transactionDate = z
  .union([localDate, z.iso.datetime({ offset: true })], 'Use a date like 2026-09-24')
  .refine((value) => {
    const time = Date.parse(value.length === 10 ? `${value}T00:00:00Z` : value);
    return time >= EARLIEST && time <= Date.now() + ONE_YEAR_MS;
  }, 'Date must be between the year 2000 and one year from today');

const tags = z
  .array(z.string().trim().toLowerCase().min(1).max(30, 'Tags can be up to 30 characters'))
  .max(10, 'Up to 10 tags')
  .transform((list) => [...new Set(list)]);

const fields = z.object({
  type: z.enum(TRANSACTION_TYPES, 'Type must be income, expense or transfer'),
  amount: positivePaise,
  walletId: objectId,
  toWalletId: objectId.nullable(),
  categoryId: objectId.nullable(),
  merchant: z.string().trim().max(100, 'Merchant name is too long'),
  note: z.string().trim().max(500, 'Note is too long'),
  tags,
  date: transactionDate,
  // 'recurring' is only ever set by the server's recurring-rule runner.
  source: z.enum(TRANSACTION_SOURCES.filter((source) => source !== 'recurring')),
  aiConfidence: z.number().min(0).max(1).nullable(),
});

export const createTransactionSchema = fields.extend({
  toWalletId: fields.shape.toWalletId.optional(),
  categoryId: fields.shape.categoryId.optional(),
  merchant: fields.shape.merchant.optional(),
  note: fields.shape.note.optional(),
  tags: tags.optional(),
  source: fields.shape.source.optional(),
  aiConfidence: fields.shape.aiConfidence.optional(),
});

// Rules that involve several fields (e.g. transfers need two different wallets) are
// checked in the service on the final, merged transaction.
export const updateTransactionSchema = nonEmptyPatch(fields.omit({ source: true }));

export const transferSchema = z.object({
  fromWalletId: objectId,
  toWalletId: objectId,
  amount: positivePaise,
  date: transactionDate,
  note: z.string().trim().max(500).optional(),
});

const MAX_PAGE_SIZE = 100;

export const listTransactionsQuery = z
  .object({
    from: localDate.optional(),
    to: localDate.optional(),
    type: z.enum(TRANSACTION_TYPES).optional(),
    walletId: objectId.optional(),
    categoryId: objectId.optional(),
    tag: z.string().trim().toLowerCase().max(30).optional(),
    minAmount: z.coerce.number().pipe(paise.min(0)).optional(),
    maxAmount: z.coerce.number().pipe(paise.min(0)).optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['date', '-date', 'amount', '-amount']).default('-date'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: '"to" must be on or after "from"',
  })
  .refine(
    (q) => q.minAmount === undefined || q.maxAmount === undefined || q.minAmount <= q.maxAmount,
    { path: ['maxAmount'], message: 'maxAmount must be at least minAmount' },
  );

const ids = z
  .array(objectId)
  .min(1, 'Select at least one transaction')
  .max(200, 'Up to 200 transactions at a time')
  .transform((list) => [...new Set(list)]);

export const bulkSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('delete'), ids }),
  z.object({ action: z.literal('categorize'), ids, categoryId: objectId }),
]);
