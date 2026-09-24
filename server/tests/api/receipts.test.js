import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { Transaction } from '../../src/models/Transaction.js';
import { signUp } from '../helpers/auth.js';
import { clearTestDB, startTestDB, stopTestDB } from '../helpers/db.js';
import { setUpMoney } from '../helpers/fixtures.js';
import { FAKE_JPEG, JPEG, PNG } from '../helpers/images.js';

let app;
let asha;
let txn;

// Files currently stored for a user (the local driver keeps one folder per user).
async function storedFiles(userId) {
  return readdir(path.join(env.UPLOAD_DIR, userId)).catch(() => []);
}

beforeAll(startTestDB);
afterAll(async () => {
  await stopTestDB();
  await rm(env.UPLOAD_DIR, { recursive: true, force: true });
});
beforeEach(async () => {
  app = createApp();
  asha = await signUp(app, { name: 'Asha' });
  const { wallets } = await setUpMoney(asha);
  txn = (
    await asha.post('/api/transactions').send({
      type: 'expense',
      amount: 25000,
      walletId: wallets.cash.id,
      merchant: 'DMart',
      date: '2026-09-20',
    })
  ).body.data.transaction;
});
afterEach(clearTestDB);

const upload = (user, id, buffer, filename = 'receipt.jpg', contentType = 'image/jpeg') =>
  user.post(`/api/transactions/${id}/receipt`).attach('receipt', buffer, { filename, contentType });

describe('receipt upload', () => {
  it('attaches a photo and links it from the transaction', async () => {
    const res = await upload(asha, txn.id, JPEG);

    expect(res.status).toBe(200);
    expect(res.body.data.transaction.receiptUrl).toBe(`/api/transactions/${txn.id}/receipt`);
    // The storage location stays on the server.
    expect(res.body.data.transaction).not.toHaveProperty('receiptKey');
    expect(await storedFiles(asha.user.id)).toHaveLength(1);
  });

  it('serves the photo only to its owner, marked private', async () => {
    await upload(asha, txn.id, PNG, 'r.png', 'image/png');

    const res = await asha.get(`/api/transactions/${txn.id}/receipt`).buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('private, max-age=3600');
    expect(Buffer.compare(res.body, PNG)).toBe(0);
  });

  it('stores the type found in the file, not the one claimed', async () => {
    // A PNG sent with a .jpg name and JPEG content type is still stored and served as PNG.
    await upload(asha, txn.id, PNG, 'photo.jpg', 'image/jpeg');
    const res = await asha.get(`/api/transactions/${txn.id}/receipt`);
    expect(res.headers['content-type']).toBe('image/png');
    expect((await storedFiles(asha.user.id))[0]).toMatch(/\.png$/);
  });

  it('replaces an earlier photo and deletes the old file', async () => {
    await upload(asha, txn.id, JPEG);
    await upload(asha, txn.id, PNG, 'r.png', 'image/png');

    const files = await storedFiles(asha.user.id);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/\.png$/);
  });

  it('removes a photo', async () => {
    await upload(asha, txn.id, JPEG);

    const res = await asha.delete(`/api/transactions/${txn.id}/receipt`);

    expect(res.body.data.transaction.receiptUrl).toBeNull();
    expect(await storedFiles(asha.user.id)).toHaveLength(0);
    expect((await asha.get(`/api/transactions/${txn.id}/receipt`)).status).toBe(404);
  });

  it('rejects a file that only pretends to be a photo', async () => {
    const res = await upload(asha, txn.id, FAKE_JPEG);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
    expect(await storedFiles(asha.user.id)).toHaveLength(0);
  });

  it('rejects other file types', async () => {
    const res = await upload(asha, txn.id, Buffer.from('%PDF-1.7'), 'r.pdf', 'application/pdf');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'UNSUPPORTED_FILE',
      message: 'Please upload a JPG, PNG or WebP photo',
    });
  });

  it('rejects photos over 5 MB', async () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await upload(asha, txn.id, big);
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
  });

  it('needs a file', async () => {
    const res = await asha.post(`/api/transactions/${txn.id}/receipt`);
    expect(res.status).toBe(400);
  });

  it('needs login', async () => {
    const res = await request(app)
      .post(`/api/transactions/${txn.id}/receipt`)
      .attach('receipt', JPEG, 'r.jpg');
    expect(res.status).toBe(401);
  });
});

describe('deleting transactions with receipts', () => {
  it('removes the photo when its transaction is deleted', async () => {
    await upload(asha, txn.id, JPEG);
    await asha.delete(`/api/transactions/${txn.id}`);
    expect(await storedFiles(asha.user.id)).toHaveLength(0);
  });

  it('removes photos of bulk-deleted transactions', async () => {
    await upload(asha, txn.id, JPEG);
    await asha.post('/api/transactions/bulk').send({ action: 'delete', ids: [txn.id] });
    expect(await storedFiles(asha.user.id)).toHaveLength(0);
  });
});

describe('receipts are private', () => {
  it("can't be viewed, replaced or removed by another user", async () => {
    await upload(asha, txn.id, JPEG);
    const ravi = await signUp(app, { name: 'Ravi' });

    expect((await ravi.get(`/api/transactions/${txn.id}/receipt`)).status).toBe(404);
    expect((await upload(ravi, txn.id, PNG, 'x.png', 'image/png')).status).toBe(404);
    expect((await ravi.delete(`/api/transactions/${txn.id}/receipt`)).status).toBe(404);

    expect(await storedFiles(asha.user.id)).toHaveLength(1);
    expect(await storedFiles(ravi.user.id)).toHaveLength(0);
    const stored = await Transaction.findById(txn.id);
    expect(stored.receiptUrl).toBe(`/api/transactions/${txn.id}/receipt`);
  });
});
