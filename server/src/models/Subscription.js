import mongoose from 'mongoose';
import { paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

export const SUBSCRIPTION_STATUSES = ['active', 'ignored', 'cancelled'];

// A repeating charge found in the user's payments (see ai/analytics/subscriptions.js).
// The numbers are refreshed on every check; `status` is the user's own choice and kept:
// "ignored" = not a subscription, "cancelled" = the user stopped it.
const subscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    merchantKey: { type: String, required: true },
    displayName: { type: String, required: true },
    avgAmount: paiseField({ required: true }),
    period: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },
    periodDays: { type: Number, required: true },
    chargeCount: { type: Number, required: true },
    lastChargedAt: { type: String, required: true }, // local date
    nextExpectedAt: { type: String, required: true }, // local date
    yearlyCost: paiseField({ required: true }),
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: 'active' },
  },
  { timestamps: true },
);

subscriptionSchema.index({ userId: 1, merchantKey: 1 }, { unique: true });

subscriptionSchema.plugin(toJSONPlugin);

export const Subscription = mongoose.model('Subscription', subscriptionSchema);
