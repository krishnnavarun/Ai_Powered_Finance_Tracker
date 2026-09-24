import { api } from './client';

// filters: { from, to, type, walletId, categoryId, tag, q, sort, page, limit } — empty ones are dropped.
// Returns { transactions, totals, pagination }.
export async function listTransactions(filters = {}) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );
  const res = await api.get('/transactions', { params });
  return res.data.data;
}

export async function createTransaction(transaction) {
  const res = await api.post('/transactions', transaction);
  return res.data.data.transaction;
}

export async function updateTransaction(id, changes) {
  const res = await api.patch(`/transactions/${id}`, changes);
  return res.data.data.transaction;
}

export async function deleteTransaction(id) {
  await api.delete(`/transactions/${id}`);
}

// { action: 'delete', ids } → { deleted, notFound }
// { action: 'categorize', ids, categoryId } → { updated, skipped, notFound }
export async function bulkTransactions(body) {
  const res = await api.post('/transactions/bulk', body);
  return res.data.data;
}

export async function uploadReceipt(id, file) {
  const form = new FormData();
  form.append('receipt', file, file.name);
  const res = await api.post(`/transactions/${id}/receipt`, form);
  return res.data.data.transaction;
}

export async function removeReceipt(id) {
  const res = await api.delete(`/transactions/${id}/receipt`);
  return res.data.data.transaction;
}

// Receipts are private, so they're fetched with the login token (not a plain <img src>).
export async function fetchReceipt(id) {
  const res = await api.get(`/transactions/${id}/receipt`, { responseType: 'blob' });
  return res.data;
}
