import * as budgetService from '../services/budget.service.js';
import * as goalService from '../services/goal.service.js';
import * as recurringService from '../services/recurring.service.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });

// ---- Budgets
export const listBudgets = async (req, res) =>
  ok(res, await budgetService.listBudgets(req.user.id, req.query));
export const budgetStatus = async (req, res) =>
  ok(res, await budgetService.budgetStatusFor(req.user.id, req.query));
export const createBudget = async (req, res) =>
  ok(res, { budget: await budgetService.createBudget(req.user.id, req.body) }, 201);
export const updateBudget = async (req, res) =>
  ok(res, { budget: await budgetService.updateBudget(req.user.id, req.params.id, req.body) });
export async function deleteBudget(req, res) {
  await budgetService.deleteBudget(req.user.id, req.params.id);
  res.status(204).end();
}

// ---- Goals
export const listGoals = async (req, res) =>
  ok(res, { goals: await goalService.listGoals(req.user.id) });
export const createGoal = async (req, res) =>
  ok(res, { goal: await goalService.createGoal(req.user.id, req.body) }, 201);
export const updateGoal = async (req, res) =>
  ok(res, { goal: await goalService.updateGoal(req.user.id, req.params.id, req.body) });
export const contribute = async (req, res) =>
  ok(res, { goal: await goalService.contribute(req.user.id, req.params.id, req.body) });
export async function deleteGoal(req, res) {
  await goalService.deleteGoal(req.user.id, req.params.id);
  res.status(204).end();
}

// ---- Recurring rules
export const listRecurring = async (req, res) =>
  ok(res, { rules: await recurringService.listRules(req.user.id) });
export const createRecurring = async (req, res) =>
  ok(res, { rule: await recurringService.createRule(req.user.id, req.body) }, 201);
export const updateRecurring = async (req, res) =>
  ok(res, { rule: await recurringService.updateRule(req.user.id, req.params.id, req.body) });
export async function deleteRecurring(req, res) {
  await recurringService.deleteRule(req.user.id, req.params.id);
  res.status(204).end();
}
