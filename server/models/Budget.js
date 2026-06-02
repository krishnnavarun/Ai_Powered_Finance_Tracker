import mongoose from 'mongoose';

const budgetSchema = new mongoose.Schema({
  // userId: ObjectId, ref: 'User', required, unique
  // monthlyBudget: Number, required, min: 0
  // categoryBudgets: [{ category: String (required), limit: Number (required, min: 0) }]
  // createdAt: Date, default: Date.now
  // updatedAt: Date, default: Date.now
});

// index: { userId: 1 }, unique

export default mongoose.model('Budget', budgetSchema);