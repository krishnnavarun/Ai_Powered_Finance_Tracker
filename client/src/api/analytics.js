import { api } from './client';

// All plain maths on the server (no AI), so these work with AI turned off.

export async function forecast() {
  const res = await api.get('/ai/forecast');
  return res.data.data;
}

export async function healthScore() {
  const res = await api.get('/ai/health-score');
  return res.data.data;
}

export async function subscriptions() {
  const res = await api.get('/ai/subscriptions');
  return res.data.data; // { subscriptions, totals }
}

// status: 'active' | 'ignored' | 'cancelled'
export async function setSubscriptionStatus(id, status) {
  const res = await api.patch(`/ai/subscriptions/${id}`, { status });
  return res.data.data.subscription;
}

export async function budgetSuggestions() {
  const res = await api.get('/ai/budget-suggestions');
  return res.data.data;
}

// changes: [{ categoryId, changePercent }]
export async function whatIf(changes) {
  const res = await api.post('/ai/what-if', { changes });
  return res.data.data;
}
