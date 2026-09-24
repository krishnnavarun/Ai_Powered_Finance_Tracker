import { api } from './client';

export async function listWallets({ includeArchived = false } = {}) {
  const res = await api.get('/wallets', { params: includeArchived ? { includeArchived } : {} });
  return res.data.data.wallets;
}

export async function createWallet(wallet) {
  const res = await api.post('/wallets', wallet);
  return res.data.data.wallet;
}

export async function updateWallet(id, changes) {
  const res = await api.patch(`/wallets/${id}`, changes);
  return res.data.data.wallet;
}

export async function deleteWallet(id) {
  await api.delete(`/wallets/${id}`);
}

// { fromWalletId, toWalletId, amount (paise), date, note? }
export async function transfer(body) {
  const res = await api.post('/wallets/transfer', body);
  return res.data.data.transaction;
}
