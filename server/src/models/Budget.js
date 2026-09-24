import mongoose from 'mongoose';
import { paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

// A spending limit for one budget month ("2026-09"), either for one expense category
// (spending in its sub-categories counts too) or overall (categoryId null).
const budgetSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: ObjectId, ref: 'Category', default: null },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    limit: paiseField({ required: true, min: 1 }),
    // Percentages at which to warn (the lowest one turns the bar amber).
    alertLevels: { type: [Number], default: () => [80, 100] },
    // Levels already alerted this month, so each alert is sent once (CP19).
    alertsSent: { type: [Number], default: () => [] },
    // Carry last month's unspent money into this month.
    rollover: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One budget per category (or one overall budget) per month.
budgetSchema.index({ userId: 1, month: 1, categoryId: 1 }, { unique: true });

budgetSchema.plugin(toJSONPlugin);

export const Budget = mongoose.model('Budget', budgetSchema);
