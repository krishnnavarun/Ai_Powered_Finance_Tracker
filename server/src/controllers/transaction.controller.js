import * as receiptService from '../services/receipt.service.js';
import * as transactionService from '../services/transaction.service.js';

export async function uploadReceipt(req, res) {
  const transaction = await receiptService.attachReceipt(req.user.id, req.params.id, req.file);
  res.json({ success: true, data: { transaction } });
}

// Streams the photo to its owner only. "private" keeps it out of shared caches.
export async function getReceipt(req, res) {
  const { buffer, contentType } = await receiptService.getReceipt(req.user.id, req.params.id);
  res.set({
    'Content-Type': contentType,
    'Cache-Control': 'private, max-age=3600',
    'Content-Disposition': 'inline',
  });
  res.send(buffer);
}

export async function removeReceipt(req, res) {
  const transaction = await receiptService.removeReceipt(req.user.id, req.params.id);
  res.json({ success: true, data: { transaction } });
}

export async function list(req, res) {
  const result = await transactionService.listTransactions(req.user.id, req.query);
  res.json({ success: true, data: result });
}

export async function get(req, res) {
  const transaction = await transactionService.getTransaction(req.user.id, req.params.id);
  res.json({ success: true, data: { transaction } });
}

export async function create(req, res) {
  const transaction = await transactionService.createTransaction(req.user.id, req.body);
  res.status(201).json({ success: true, data: { transaction } });
}

export async function update(req, res) {
  const transaction = await transactionService.updateTransaction(
    req.user.id,
    req.params.id,
    req.body,
  );
  res.json({ success: true, data: { transaction } });
}

export async function remove(req, res) {
  await transactionService.deleteTransaction(req.user.id, req.params.id);
  res.status(204).end();
}

export async function bulk(req, res) {
  const result = await transactionService.bulkAction(req.user.id, req.body);
  res.json({ success: true, data: result });
}

export async function transfer(req, res) {
  const transaction = await transactionService.transfer(req.user.id, req.body);
  res.status(201).json({ success: true, data: { transaction } });
}
