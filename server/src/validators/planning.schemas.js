import { z } from 'zod';
import { GOAL_STATUSES } from '../models/Goal.js';
import { FREQUENCIES } from '../utils/recurrence.js';
import { hexColor, iconName, nonEmptyPatch, objectId, paise, positivePaise } from './common.js';

const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a month like 2026-09');
const localDate = z.iso.date('Use a date like 2026-09-24');

// ---- Budgets ----------------------------------------------------------------------

const alertLevels = z
  .array(z.int().min(1, 'Alert levels are percentages from 1 to 200').max(200))
  .min(1)
  .max(4)
  .transform((levels) => [...new Set(levels)].sort((a, b) => a - b));

export const createBudgetSchema = z.object({
  categoryId: objectId.nullable().default(null), // null = overall budget
  month,
  limit: positivePaise,
  alertLevels: alertLevels.optional(),
  rollover: z.boolean().optional(),
});

// The category and month of a budget can't change; create a new one instead.
export const updateBudgetSchema = nonEmptyPatch(
  z.object({ limit: positivePaise, alertLevels, rollover: z.boolean() }),
);

export const monthQuery = z.object({ month: month.optional() });

// ---- Goals ------------------------------------------------------------------------

const goalFields = z.object({
  name: z.string().trim().min(1, 'Give the goal a name').max(60, 'Name is too long'),
  targetAmount: positivePaise,
  deadline: localDate.nullable(),
  linkedWalletId: objectId.nullable(),
  icon: iconName,
  color: hexColor,
  status: z.enum(GOAL_STATUSES),
});

export const createGoalSchema = goalFields.omit({ status: true }).extend({
  deadline: localDate.nullable().optional(),
  linkedWalletId: objectId.nullable().optional(),
  icon: iconName.optional(),
  color: hexColor.optional(),
  // Money already saved before tracking it here.
  savedAmount: paise.min(0, 'Cannot be negative').optional(),
});

export const updateGoalSchema = nonEmptyPatch(goalFields);

// Positive amount = add money; negative = take some out.
export const contributeSchema = z.object({
  amount: paise.refine((value) => value !== 0, 'Amount cannot be zero'),
  date: localDate.optional(),
  note: z.string().trim().max(200).optional(),
});

// ---- Recurring rules --------------------------------------------------------------

const template = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: positivePaise,
  walletId: objectId,
  toWalletId: objectId.nullable().optional(),
  categoryId: objectId.nullable().optional(),
  merchant: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
});

const schedule = {
  frequency: z.enum(FREQUENCIES, 'Repeat daily, weekly, monthly or yearly'),
  interval: z.int().min(1).max(365).optional(),
  startDate: localDate,
  endDate: localDate.nullable().optional(),
};

const endAfterStart = (rule) => !rule.endDate || !rule.startDate || rule.endDate >= rule.startDate;

export const createRecurringSchema = z
  .object({ template, ...schedule, active: z.boolean().optional() })
  .refine(endAfterStart, {
    path: ['endDate'],
    message: 'End date must be on or after the start date',
  });

export const updateRecurringSchema = nonEmptyPatch(
  z.object({
    template,
    frequency: schedule.frequency,
    interval: z.int().min(1).max(365),
    startDate: localDate,
    endDate: localDate.nullable(),
    active: z.boolean(),
  }),
).refine(endAfterStart, {
  path: ['endDate'],
  message: 'End date must be on or after the start date',
});
