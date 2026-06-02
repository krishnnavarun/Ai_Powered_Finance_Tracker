import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { generateAIInsights, predictExpense } from '../services/aiService.js';

export const generateInsights = async (req, res) => {
  // fetch transactions + budget by req.userId
  // call generateAIInsights({ transactions, budget })
  // 200: { success, data: result, insights: result.insights }
  // catch → 500: { success: false, message }
};

export const predictSpending = async (req, res) => {
  // fetch transactions + budget by req.userId
  // call predictExpense({ transactions, budget })
  // 200: { success, data: prediction, prediction }
  // catch → 500: { success: false, message }
};