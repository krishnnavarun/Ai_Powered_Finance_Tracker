import mongoose from 'mongoose';
import { paiseField } from './fields.js';
import { toJSONPlugin } from './plugins/toJSON.js';

export const TRANSACTION_TYPES = ['income', 'expense', 'transfer'];
export const TRANSACTION_SOURCES = ['manual', 'nl', 'sms', 'receipt', 'csv', 'recurring'];

const { ObjectId } = mongoose.Schema.Types;

// One money movement. Wallet balances are derived from these (see transaction.service.js):
//   expense  → walletId −amount
//   income   → walletId +amount
//   transfer → walletId −amount, toWalletId +amount
const transactionSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, ref: 'User', required: true },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    // Always positive; the type decides the direction.
    amount: paiseField({ required: true, min: 1 }),
    walletId: { type: ObjectId, ref: 'Wallet', required: true },
    toWalletId: { type: ObjectId, ref: 'Wallet', default: null }, // transfers only
    categoryId: { type: ObjectId, ref: 'Category', default: null }, // not for transfers
    merchant: { type: String, trim: true, maxlength: 100, default: '' },
    merchantKey: { type: String, default: '' }, // normalizeMerchant(merchant)
    note: { type: String, trim: true, maxlength: 500, default: '' },
    tags: { type: [String], default: [] },
    date: { type: Date, required: true },
    source: { type: String, enum: TRANSACTION_SOURCES, default: 'manual' },
    aiConfidence: { type: Number, min: 0, max: 1, default: null },
    // Where the receipt photo is stored (storage key). Private: the client gets receiptUrl.
    receiptKey: { type: String, default: null, private: true },
    receiptUrl: { type: String, default: null },
    recurringId: { type: ObjectId, ref: 'RecurringRule', default: null },
    isDuplicateFlag: { type: Boolean, default: false },
  },
  { timestamps: true },
);

transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ userId: 1, merchantKey: 1 });
transactionSchema.index({ userId: 1, walletId: 1, date: -1 });
transactionSchema.index({ userId: 1, toWalletId: 1 }, { sparse: true });

transactionSchema.plugin(toJSONPlugin);

export const Transaction = mongoose.model('Transaction', transactionSchema);
