import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

const settingsSchema = new mongoose.Schema(
  {
    aiEnabled: { type: Boolean, default: true },
    digestEmail: { type: Boolean, default: true },
    budgetAlerts: { type: Boolean, default: true },
    theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Never returned by queries unless asked for with .select('+passwordHash').
    passwordHash: { type: String, required: true, select: false, private: true },
    avatarUrl: { type: String, default: null },
    currency: { type: String, default: 'INR' },
    // Day the user's "month" starts (e.g. salary day). Capped at 28 so it exists in every month.
    monthStartDay: { type: Number, default: 1, min: 1, max: 28 },
    timezone: { type: String, default: 'Asia/Kolkata' },
    settings: { type: settingsSchema, default: () => ({}) },
    onboardingDone: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.plugin(toJSONPlugin);

export const User = mongoose.model('User', userSchema);
