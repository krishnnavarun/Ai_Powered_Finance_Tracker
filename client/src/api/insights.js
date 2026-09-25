import { api } from './client';

// → { insights, unseen }
export async function listInsights({ includeDismissed = false } = {}) {
  const res = await api.get('/insights', { params: includeDismissed ? { includeDismissed } : {} });
  return res.data.data;
}

// Works out new insights now (the worker also does this every night). → { created, insights, unseen }
export async function refreshInsights() {
  const res = await api.post('/insights/refresh');
  return res.data.data;
}

export async function updateInsight(id, changes) {
  const res = await api.patch(`/insights/${id}`, changes);
  return res.data.data.insight;
}

export async function markInsightsSeen(ids) {
  const res = await api.post('/insights/seen', { ids });
  return res.data.data;
}
