import { logger } from '../config/logger.js';
import { Transaction } from '../models/Transaction.js';
import { getReceiptStorage } from '../storage/index.js';
import { ApiError } from '../utils/ApiError.js';
import { contentTypeForKey, detectImageType } from '../utils/imageType.js';
import { findOwnedOrThrow } from './ownership.js';

// Receipts are always served through the API (never a public link), so only the
// logged-in owner can see them.
const receiptUrlFor = (transactionId) => `/api/transactions/${transactionId}/receipt`;

// Deletes stored files without failing the request — used after the database change
// has already succeeded (e.g. the transaction was deleted).
export async function removeReceiptFiles(keys) {
  const storage = getReceiptStorage();
  await Promise.all(
    keys
      .filter(Boolean)
      .map((key) =>
        storage
          .remove(key)
          .catch((err) => logger.warn({ err: err.message }, 'Could not delete receipt file')),
      ),
  );
}

export async function attachReceipt(userId, transactionId, file) {
  if (!file) throw ApiError.badRequest('Choose a photo of the receipt');
  const image = detectImageType(file.buffer);
  if (!image) throw new ApiError(400, 'UNSUPPORTED_FILE', 'Please upload a JPG, PNG or WebP photo');

  const txn = await findOwnedOrThrow(Transaction, userId, transactionId, { label: 'Transaction' });
  const oldKey = txn.receiptKey;

  const { key } = await getReceiptStorage().save({
    userId,
    buffer: file.buffer,
    extension: image.extension,
    contentType: image.type,
  });
  txn.receiptKey = key;
  txn.receiptUrl = receiptUrlFor(txn._id);
  try {
    await txn.save();
  } catch (err) {
    await removeReceiptFiles([key]); // don't leave an orphaned file behind
    throw err;
  }
  await removeReceiptFiles([oldKey]); // replaced photo
  return txn;
}

export async function getReceipt(userId, transactionId) {
  const txn = await Transaction.findOne({ _id: transactionId, userId }).select('+receiptKey');
  if (!txn?.receiptKey) throw ApiError.notFound('Receipt not found');
  const buffer = await getReceiptStorage().read(txn.receiptKey);
  return { buffer, contentType: contentTypeForKey(txn.receiptKey) };
}

export async function removeReceipt(userId, transactionId) {
  const txn = await findOwnedOrThrow(Transaction, userId, transactionId, { label: 'Transaction' });
  const oldKey = txn.receiptKey;
  txn.receiptKey = null;
  txn.receiptUrl = null;
  await txn.save();
  await removeReceiptFiles([oldKey]);
  return txn;
}
