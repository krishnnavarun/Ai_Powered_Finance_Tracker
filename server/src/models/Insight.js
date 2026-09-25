import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

export const INSIGHT_TYPES = [
  'anomaly',
  'forecast',
  'budget',
  'subscription',
  'duplicate',
  'tip',
  'goal',
];
export const INSIGHT_SEVERITIES = ['info', 'warn', 'critical'];

// A tip or warning for the user, made by the worker from plain maths. `reason` is the
// "Why?" text with the numbers used; `data` holds those numbers for charts.
// `dedupeKey` makes the same insight (e.g. "Food spike, week of 21 Sep") appear once.
const insightSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: INSIGHT_TYPES, required: true },
    severity: { type: String, enum: INSIGHT_SEVERITIES, default: 'info' },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 500 },
    reason: { type: String, default: '', maxlength: 1000 },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    seen: { type: Boolean, default: false },
    dismissed: { type: Boolean, default: false },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true },
);

insightSchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
insightSchema.index({ userId: 1, dismissed: 1, createdAt: -1 });

insightSchema.plugin(toJSONPlugin);

export const Insight = mongoose.model('Insight', insightSchema);
