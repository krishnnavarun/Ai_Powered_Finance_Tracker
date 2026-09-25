import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

const { ObjectId } = mongoose.Schema.Types;

// The categorizer's memory: "this user files swiggy under Food & Dining".
// Written when the user picks or corrects a category; read before any rule or AI call.
const merchantMapSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    merchantKey: { type: String, required: true }, // normalizeMerchant() output
    categoryId: { type: ObjectId, ref: 'Category', required: true },
    hits: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

merchantMapSchema.index({ userId: 1, merchantKey: 1 }, { unique: true });

merchantMapSchema.plugin(toJSONPlugin);

export const MerchantMap = mongoose.model('MerchantMap', merchantMapSchema);
