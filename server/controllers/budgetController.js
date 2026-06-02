import Budget from '../models/Budget.js';

export const setBudget = async (req, res) => {
  // extract { monthlyBudget, categoryBudgets } from req.body
  // 400 if monthlyBudget missing, null, empty, or < 0
  // findOneAndUpdate { userId } with { monthlyBudget, categoryBudgets || [], updatedAt } (upsert: true)
  // 200: { success, message, data: budget }
  // catch → 500: { success: false, message }
};

export const getBudget = async (req, res) => {
  // find budget by req.userId
  // if not found → 200: { success, data: { monthlyBudget: 0, categoryBudgets: [] } }
  // 200: { success, data: budget }
  // catch → 500: { success: false, message }
};

export const updateBudget = async (req, res) => {
  // extract { monthlyBudget, categoryBudgets } from req.body
  // 400 if monthlyBudget missing, null, empty, or < 0
  // findOneAndUpdate { userId } with { monthlyBudget, categoryBudgets, updatedAt }
  // 404 if budget not found
  // 200: { success, message, data: budget }
  // catch → 500: { success: false, message }
};