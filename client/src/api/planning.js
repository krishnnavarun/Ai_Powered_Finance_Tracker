import { api } from './client';

// ---- Budgets
export async function listBudgets(month) {
  const res = await api.get('/budgets', { params: month ? { month } : {} });
  return res.data.data; // { month, budgets }
}

export async function budgetStatus(month) {
  const res = await api.get('/budgets/status', { params: month ? { month } : {} });
  return res.data.data; // { month, fromDate, toDate, daysLeft, totalSpent, budgets[] }
}

export async function createBudget(budget) {
  const res = await api.post('/budgets', budget);
  return res.data.data.budget;
}

export async function updateBudget(id, changes) {
  const res = await api.patch(`/budgets/${id}`, changes);
  return res.data.data.budget;
}

export async function deleteBudget(id) {
  await api.delete(`/budgets/${id}`);
}

// ---- Goals
export async function listGoals() {
  const res = await api.get('/goals');
  return res.data.data.goals;
}

export async function createGoal(goal) {
  const res = await api.post('/goals', goal);
  return res.data.data.goal;
}

export async function updateGoal(id, changes) {
  const res = await api.patch(`/goals/${id}`, changes);
  return res.data.data.goal;
}

export async function deleteGoal(id) {
  await api.delete(`/goals/${id}`);
}

// amount > 0 adds money, amount < 0 takes it out. Returns the goal (+ justCompleted).
export async function contribute(id, body) {
  const res = await api.post(`/goals/${id}/contribute`, body);
  return res.data.data.goal;
}

// ---- Reports
export async function spendingByCategory(params = {}) {
  const res = await api.get('/reports/by-category', { params });
  return res.data.data; // { from, to, total, categories[] }
}

export async function monthlyTrend(months = 6) {
  const res = await api.get('/reports/trend', { params: { months } });
  return res.data.data.months;
}

export async function reportSummary(params = {}) {
  const res = await api.get('/reports/summary', { params });
  return res.data.data;
}

export async function topMerchants(params = {}) {
  const res = await api.get('/reports/merchants', { params });
  return res.data.data;
}

export async function spendingByWallet(params = {}) {
  const res = await api.get('/reports/by-wallet', { params });
  return res.data.data;
}

// Downloads the export as a file. Returns { blob, filename } (filename from the server).
export async function exportReport({ format, from, to }) {
  const res = await api.get('/reports/export', {
    params: { format, ...(from ? { from, to } : {}) },
    responseType: 'blob',
  });
  const disposition = res.headers['content-disposition'] ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `paisa-pal-report.${format}`;
  return { blob: res.data, filename };
}

// ---- Recurring payments
export async function listRecurring() {
  const res = await api.get('/recurring');
  return res.data.data.rules;
}

export async function createRecurring(rule) {
  const res = await api.post('/recurring', rule);
  return res.data.data.rule;
}

export async function updateRecurring(id, changes) {
  const res = await api.patch(`/recurring/${id}`, changes);
  return res.data.data.rule;
}

export async function deleteRecurring(id) {
  await api.delete(`/recurring/${id}`);
}
