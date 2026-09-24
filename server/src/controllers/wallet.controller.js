import * as walletService from '../services/wallet.service.js';

export async function list(req, res) {
  const wallets = await walletService.listWallets(req.user.id, req.query);
  res.json({ success: true, data: { wallets } });
}

export async function get(req, res) {
  const wallet = await walletService.getWallet(req.user.id, req.params.id);
  res.json({ success: true, data: { wallet } });
}

export async function create(req, res) {
  const wallet = await walletService.createWallet(req.user.id, req.body);
  res.status(201).json({ success: true, data: { wallet } });
}

export async function update(req, res) {
  const wallet = await walletService.updateWallet(req.user.id, req.params.id, req.body);
  res.json({ success: true, data: { wallet } });
}

export async function remove(req, res) {
  await walletService.deleteWallet(req.user.id, req.params.id);
  res.status(204).end();
}
