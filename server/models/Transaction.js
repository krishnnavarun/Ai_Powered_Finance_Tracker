import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  // userId: ObjectId, ref: 'User', required
  // type: String, enum: ['income', 'expense'], required
  // title: String, required
  // amount: Number, required, min: 0
  // category: String, required
  // paymentMethod: String, enum: ['cash','card','bank_transfer','upi','wallet','other'], default: 'card'
  // description: String, trim
  // transactionDate: Date, required, default: Date.now
  // createdAt: Date, default: Date.now
});

// index: { userId: 1, transactionDate: -1 }
// index: { userId: 1, type: 1 }
// index: { userId: 1, category: 1 }

export default mongoose.model('Transaction', transactionSchema);