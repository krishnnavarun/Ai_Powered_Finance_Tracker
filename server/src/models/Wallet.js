import mongoose from 'mongoose';
import { CASE_INSENSITIVE, paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

export const WALLET_TYPES = ['cash', 'bank', 'upi', 'card', 'savings', 'other'];

// A place money lives: cash in hand, a bank account, a UPI wallet, a credit card…
// `balance` is only ever changed by transactions (CP8) or by editing openingBalance.
const walletSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    type: { type: String, enum: WALLET_TYPES, required: true },
    // Can be negative, e.g. money owed on a credit card.
    openingBalance: paiseField({ required: true, default: 0 }),
    balance: paiseField({ required: true, default: 0 }),
    // Only for cards.
    creditLimit: paiseField({ default: null, min: 0 }),
    color: { type: String, default: '#0f766e' },
    icon: { type: String, default: 'wallet' },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One "HDFC Savings" per user, ignoring upper/lower case.
walletSchema.index({ userId: 1, name: 1 }, { unique: true, collation: CASE_INSENSITIVE });

walletSchema.plugin(toJSONPlugin);

export const Wallet = mongoose.model('Wallet', walletSchema);
