import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

export const NOTIFICATION_KINDS = ['budget', 'insight', 'digest', 'recurring', 'system'];

// A short message in the bell menu, with an optional link into the app.
const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, default: 'system' },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 1000 },
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, createdAt: -1 });

notificationSchema.plugin(toJSONPlugin);

export const Notification = mongoose.model('Notification', notificationSchema);
