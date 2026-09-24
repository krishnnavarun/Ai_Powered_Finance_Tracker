import mongoose from 'mongoose';
import { paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

export const GOAL_STATUSES = ['active', 'done', 'paused'];

// Money put in or taken out of a goal. Kept on the goal (a goal has few of these).
const contributionSchema = new mongoose.Schema(
  {
    amount: paiseField({ required: true }), // positive = added, negative = taken out
    date: { type: String, required: true }, // local date "2026-09-24"
    note: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { _id: true, timestamps: { createdAt: true, updatedAt: false } },
);

// Something the user is saving for, e.g. "New phone — ₹60,000 by December".
const goalSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    targetAmount: paiseField({ required: true, min: 1 }),
    savedAmount: paiseField({ required: true, default: 0, min: 0 }),
    deadline: { type: String, default: null }, // local date or null
    // Where the savings are kept (for display; contributions don't move money).
    linkedWalletId: { type: ObjectId, ref: 'Wallet', default: null },
    icon: { type: String, default: 'target' },
    color: { type: String, default: '#0f766e' },
    status: { type: String, enum: GOAL_STATUSES, default: 'active' },
    contributions: { type: [contributionSchema], default: () => [] },
  },
  { timestamps: true },
);

goalSchema.plugin(toJSONPlugin);

export const Goal = mongoose.model('Goal', goalSchema);
