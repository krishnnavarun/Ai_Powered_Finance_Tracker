import { apiError, http, HttpResponse, server } from './msw';

// A tiny in-memory version of the wallets / categories / transactions API, so page tests
// can add, edit and delete things and see the result, like against the real server.
// Balances and totals are computed the same way the server does.

let counter = 0;
const newId = () => (++counter).toString(16).padStart(24, '0');

const CATEGORY_SEED = [
  ['Food & Dining', 'expense', 'utensils', '#f97316'],
  ['Groceries', 'expense', 'shopping-basket', '#84cc16'],
  ['Transport', 'expense', 'car', '#0ea5e9'],
  ['Salary', 'income', 'briefcase', '#16a34a'],
  ['Refund', 'income', 'undo-2', '#0891b2'],
];

// "2026-09-24" → start of that day in India, like the server.
function toIso(date) {
  return date.length === 10 ? new Date(`${date}T00:00:00+05:30`).toISOString() : date;
}

function effects(txn) {
  if (txn.type === 'income') return [[txn.walletId, txn.amount]];
  if (txn.type === 'expense') return [[txn.walletId, -txn.amount]];
  return [
    [txn.walletId, -txn.amount],
    [txn.toWalletId, txn.amount],
  ];
}

export function installFakeApi({ wallets = [], transactions = [] } = {}) {
  const db = {
    wallets: wallets.map((wallet) => ({
      id: newId(),
      type: 'bank',
      openingBalance: 0,
      creditLimit: null,
      color: '#0f766e',
      icon: 'landmark',
      isArchived: false,
      ...wallet,
    })),
    categories: CATEGORY_SEED.map(([name, type, icon, color]) => ({
      id: newId(),
      name,
      type,
      icon,
      color,
      parentId: null,
      isArchived: false,
    })),
    transactions: [],
    receipts: new Map(), // transaction id → uploaded File
    requests: [], // every write request, for assertions: { method, path, body }
  };

  const walletId = (name) => db.wallets.find((w) => w.name === name)?.id;
  const categoryId = (name) => db.categories.find((c) => c.name === name)?.id ?? null;

  // Seed transactions may name their wallet/category: { wallet: 'Cash', category: 'Groceries' }.
  db.transactions = transactions.map(({ wallet, toWallet, category, ...txn }, index) => ({
    id: newId(),
    type: 'expense',
    merchant: '',
    note: '',
    tags: [],
    source: 'manual',
    aiConfidence: null,
    toWalletId: toWallet ? walletId(toWallet) : null,
    categoryId: category ? categoryId(category) : null,
    walletId: walletId(wallet ?? db.wallets[0]?.name),
    date: toIso(txn.date ?? `2026-09-${String(20 - (index % 19)).padStart(2, '0')}`),
    ...txn,
  }));

  const withBalance = (wallet) => {
    const change = db.transactions
      .flatMap(effects)
      .filter(([id]) => id === wallet.id)
      .reduce((sum, [, delta]) => sum + delta, 0);
    return { ...wallet, balance: wallet.openingBalance + change };
  };

  const record = async (request, path) => {
    const body = request.method === 'DELETE' ? null : await request.json().catch(() => null);
    db.requests.push({ method: request.method, path, body });
    return body;
  };

  const ok = (data, status = 200) => HttpResponse.json({ success: true, data }, { status });

  server.use(
    // ---- wallets
    http.get('*/api/wallets', ({ request }) => {
      const all = new URL(request.url).searchParams.get('includeArchived') === 'true';
      return ok({ wallets: db.wallets.filter((w) => all || !w.isArchived).map(withBalance) });
    }),
    http.post('*/api/wallets/transfer', async ({ request }) => {
      const body = await record(request, '/wallets/transfer');
      const txn = {
        id: newId(),
        type: 'transfer',
        amount: body.amount,
        walletId: body.fromWalletId,
        toWalletId: body.toWalletId,
        categoryId: null,
        merchant: '',
        note: body.note ?? '',
        tags: [],
        source: 'manual',
        aiConfidence: null,
        date: toIso(body.date),
      };
      db.transactions.push(txn);
      return ok({ transaction: txn }, 201);
    }),
    http.post('*/api/wallets', async ({ request }) => {
      const body = await record(request, '/wallets');
      if (db.wallets.some((w) => w.name.toLowerCase() === body.name.toLowerCase())) {
        return apiError(409, 'DUPLICATE_NAME', `You already have a wallet named "${body.name}"`);
      }
      const wallet = { id: newId(), isArchived: false, creditLimit: null, ...body };
      db.wallets.push(wallet);
      return ok({ wallet: withBalance(wallet) }, 201);
    }),
    http.patch('*/api/wallets/:id', async ({ request, params }) => {
      const body = await record(request, `/wallets/${params.id}`);
      const wallet = db.wallets.find((w) => w.id === params.id);
      Object.assign(wallet, body);
      return ok({ wallet: withBalance(wallet) });
    }),
    http.delete('*/api/wallets/:id', async ({ request, params }) => {
      await record(request, `/wallets/${params.id}`);
      if (db.transactions.some((t) => t.walletId === params.id || t.toWalletId === params.id)) {
        return apiError(
          409,
          'WALLET_IN_USE',
          'This wallet has transactions. Archive it to hide it, or delete its transactions first.',
        );
      }
      db.wallets = db.wallets.filter((w) => w.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),

    // ---- categories
    http.get('*/api/categories', () => ok({ categories: db.categories })),

    // ---- transactions
    http.get('*/api/transactions', ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      const matches = db.transactions
        .filter((t) => !params.get('type') || t.type === params.get('type'))
        .filter(
          (t) =>
            !params.get('walletId') ||
            t.walletId === params.get('walletId') ||
            t.toWalletId === params.get('walletId'),
        )
        .filter((t) => !params.get('categoryId') || t.categoryId === params.get('categoryId'))
        .filter((t) => !q || `${t.merchant} ${t.note}`.toLowerCase().includes(q))
        .sort((a, b) => b.date.localeCompare(a.date));

      const page = Number(params.get('page') ?? 1);
      const limit = Number(params.get('limit') ?? 25);
      const totals = { income: 0, expense: 0, transfer: 0 };
      for (const t of matches) totals[t.type] += t.amount;

      return ok({
        transactions: matches.slice((page - 1) * limit, page * limit),
        totals,
        pagination: {
          page,
          limit,
          total: matches.length,
          totalPages: Math.max(1, Math.ceil(matches.length / limit)),
        },
      });
    }),
    http.post('*/api/transactions', async ({ request }) => {
      const body = await record(request, '/transactions');
      const txn = {
        id: newId(),
        toWalletId: null,
        categoryId: null,
        merchant: '',
        note: '',
        tags: [],
        source: 'manual',
        aiConfidence: null,
        ...body,
        date: toIso(body.date),
      };
      db.transactions.push(txn);
      return ok({ transaction: txn }, 201);
    }),
    http.patch('*/api/transactions/:id', async ({ request, params }) => {
      const body = await record(request, `/transactions/${params.id}`);
      const txn = db.transactions.find((t) => t.id === params.id);
      Object.assign(txn, body, body.date ? { date: toIso(body.date) } : {});
      if (txn.type !== 'transfer' && !('toWalletId' in body)) txn.toWalletId = null;
      if (txn.type === 'transfer' && !('categoryId' in body)) txn.categoryId = null;
      return ok({ transaction: txn });
    }),
    http.delete('*/api/transactions/:id', async ({ request, params }) => {
      await record(request, `/transactions/${params.id}`);
      db.transactions = db.transactions.filter((t) => t.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('*/api/transactions/bulk', async ({ request }) => {
      const body = await record(request, '/transactions/bulk');
      const found = db.transactions.filter((t) => body.ids.includes(t.id));
      const notFound = body.ids.length - found.length;
      if (body.action === 'delete') {
        db.transactions = db.transactions.filter((t) => !body.ids.includes(t.id));
        return ok({ deleted: found.length, notFound });
      }
      const category = db.categories.find((c) => c.id === body.categoryId);
      const matching = found.filter((t) => t.type === category.type);
      matching.forEach((t) => (t.categoryId = category.id));
      return ok({ updated: matching.length, skipped: found.length - matching.length, notFound });
    }),

    // ---- receipts (the photo bytes are kept so tests can check what was sent)
    http.post('*/api/transactions/:id/receipt', async ({ request, params }) => {
      // Read the multipart body as text: Node's formData() parser can't handle jsdom's
      // File objects. The field name and file name are all the tests need.
      const raw = await request.text();
      const field = /name="([^"]+)"/.exec(raw)?.[1];
      const name = /filename="([^"]+)"/.exec(raw)?.[1];
      db.requests.push({
        method: 'POST',
        path: `/transactions/${params.id}/receipt`,
        body: { field, file: { name } },
      });
      const txn = db.transactions.find((t) => t.id === params.id);
      txn.receiptUrl = `/api/transactions/${txn.id}/receipt`;
      db.receipts.set(txn.id, new Blob([new Uint8Array(8)], { type: 'image/png' }));
      return ok({ transaction: txn });
    }),
    http.get('*/api/transactions/:id/receipt', ({ params }) => {
      const file = db.receipts.get(params.id);
      if (!file) return apiError(404, 'NOT_FOUND', 'Receipt not found');
      return new HttpResponse(file, { headers: { 'Content-Type': file.type || 'image/png' } });
    }),
    http.delete('*/api/transactions/:id/receipt', ({ params }) => {
      db.requests.push({
        method: 'DELETE',
        path: `/transactions/${params.id}/receipt`,
        body: null,
      });
      const txn = db.transactions.find((t) => t.id === params.id);
      txn.receiptUrl = null;
      db.receipts.delete(txn.id);
      return ok({ transaction: txn });
    }),
  );

  return {
    db,
    walletId,
    categoryId,
    balanceOf: (name) => withBalance(db.wallets.find((w) => w.name === name)).balance,
  };
}
