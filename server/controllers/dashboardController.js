import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';
import { summarizeTransactions } from '../services/financeAnalyzer.js';

export const getDashboardSummary = async (req, res) => {
  // fetch transactions by req.userId (sorted by transactionDate desc) + budget
  // summarizeTransactions(transactions, budget)
  // 200: { success, data: { totalIncome, totalExpense, savings, budgetRemaining,
  //        monthlyTrend, categoryBreakdown, recentTransactions: transactions.slice(0,5) } }
  // catch → 500: { success: false, message }
};