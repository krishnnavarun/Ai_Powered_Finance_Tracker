import mongoose from 'mongoose';
import { FREQUENCIES } from '../utils/recurrence.js';
import { paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

// The transaction to create each time the rule runs.
const templateSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['income', 'expense', 'transfer'], required: true },
    amount: paiseField({ required: true, min: 1 }),
    walletId: { type: ObjectId, ref: 'Wallet', required: true },
    toWalletId: { type: ObjectId, ref: 'Wallet', default: null },
    categoryId: { type: ObjectId, ref: 'Category', default: null },
    merchant: { type: String, trim: true, maxlength: 100, default: '' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { _id: false },
);

// A payment that repeats: rent on the 1st, salary on the 30th, a weekly SIP…
// The worker (CP19) creates the transaction when `nextRun` arrives.
const recurringRuleSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    template: { type: templateSchema, required: true },
    frequency: { type: String, enum: FREQUENCIES, required: true },
    interval: { type: Number, min: 1, max: 365, default: 1 }, // every N days/weeks/months/years
    startDate: { type: String, required: true }, // local date; all dates count from here
    endDate: { type: String, default: null },
    nextDate: { type: String, default: null }, // next local date (null once finished)
    nextRun: { type: Date, default: null }, // the moment nextDate starts, for the worker
    lastRunDate: { type: String, default: null },
    detectedByAI: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// The worker looks for active rules that are due.
recurringRuleSchema.index({ active: 1, nextRun: 1 });

recurringRuleSchema.plugin(toJSONPlugin);

export const RecurringRule = mongoose.model('RecurringRule', recurringRuleSchema);
