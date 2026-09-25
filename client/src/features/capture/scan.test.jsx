import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { apiError, http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';
import { readTextOnDevice } from './ocr';

// On-device reading (Tesseract) is replaced: jsdom can't run it, and it needs downloads.
vi.mock('./ocr', () => ({
  readTextOnDevice: vi.fn(async (_file, onProgress) => {
    onProgress?.(60);
    return 'Apollo Pharmacy\nAmount Payable: 1,250.50';
  }),
}));

const ok = (data) => HttpResponse.json({ success: true, data });
const photo = () =>
  new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'bill.jpg', { type: 'image/jpeg' });

const draft = (fields) => ({
  type: 'expense',
  walletId: null,
  toWalletId: null,
  note: '',
  date: '2026-09-23',
  source: 'receipt',
  ...fields,
});

async function openScanTab(user) {
  await user.click(await screen.findByRole('button', { name: /add transaction/i }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('tab', { name: 'Receipt' }));
  return dialog;
}

describe('scanning a receipt', () => {
  it('reads the photo with AI and attaches it to the new payment', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets: [{ name: 'HDFC' }] });
    const groceries = api.db.categories.find((c) => c.name === 'Groceries');
    let uploaded = false;
    server.use(
      http.post('*/api/ai/parse/receipt', async ({ request }) => {
        uploaded = (await request.text()).includes('name="receipt"');
        return ok({
          usedAI: true,
          items: [],
          tax: null,
          draft: draft({
            amount: 62476,
            merchant: 'DMart',
            categoryId: groceries.id,
            note: 'Milk, Bread and 2 more',
            aiConfidence: 0.88,
          }),
        });
      }),
    );
    renderApp('/transactions');

    const dialog = await openScanTab(user);
    await user.upload(within(dialog).getByLabelText('Receipt photo'), photo());
    expect(within(dialog).getByRole('img', { name: 'Receipt to read' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Read receipt' }));

    expect(await within(dialog).findByLabelText('Amount')).toHaveValue('624.76');
    expect(uploaded).toBe(true);
    expect(within(dialog).getByLabelText('Where (optional)')).toHaveValue('DMart');
    expect(within(dialog).getByLabelText('Category')).toHaveDisplayValue('Groceries');
    expect(readTextOnDevice).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));
    await findToast('Transaction added');
    const saved = api.db.transactions.at(-1);
    expect(saved).toMatchObject({ amount: 62476, source: 'receipt' });
    // The photo was saved with the payment.
    await waitFor(() => expect(api.db.receipts.has(saved.id)).toBe(true));
  });

  it('reads the photo on the device when AI is off', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'HDFC' }] });
    const sentText = [];
    server.use(
      http.get('*/api/ai/status', () =>
        ok({ enabled: false, configured: true, provider: 'gemini' }),
      ),
      http.post('*/api/ai/parse/receipt', () => apiError(500, 'SHOULD_NOT_BE_CALLED', 'no')),
      http.post('*/api/ai/parse/receipt-text', async ({ request }) => {
        sentText.push((await request.json()).text);
        return ok({
          usedAI: false,
          items: [],
          tax: null,
          draft: draft({
            amount: 125050,
            merchant: 'Apollo Pharmacy',
            categoryId: null,
            aiConfidence: 0.5,
          }),
        });
      }),
    );
    renderApp('/transactions');

    const dialog = await openScanTab(user);
    expect(await within(dialog).findByText(/read on this device/)).toBeInTheDocument();
    await user.upload(within(dialog).getByLabelText('Receipt photo'), photo());
    await user.click(within(dialog).getByRole('button', { name: 'Read receipt' }));

    expect(await within(dialog).findByLabelText('Amount')).toHaveValue('1250.50');
    expect(sentText).toEqual(['Apollo Pharmacy\nAmount Payable: 1,250.50']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('some details may be wrong');
  });

  it('falls back to the device when the AI is down', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'HDFC' }] });
    server.use(
      http.post('*/api/ai/parse/receipt', () =>
        apiError(503, 'AI_UNAVAILABLE', 'AI is not available right now.'),
      ),
      http.post('*/api/ai/parse/receipt-text', () =>
        ok({
          usedAI: false,
          items: [],
          tax: null,
          draft: draft({ amount: 125050, merchant: 'Apollo', categoryId: null, aiConfidence: 0.5 }),
        }),
      ),
    );
    renderApp('/transactions');

    const dialog = await openScanTab(user);
    await user.upload(within(dialog).getByLabelText('Receipt photo'), photo());
    await user.click(within(dialog).getByRole('button', { name: 'Read receipt' }));

    expect(await within(dialog).findByLabelText('Amount')).toHaveValue('1250.50');
  });

  it('refuses files that are too big', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'HDFC' }] });
    renderApp('/transactions');

    const dialog = await openScanTab(user);
    const huge = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    await user.upload(within(dialog).getByLabelText('Receipt photo'), huge);

    expect(within(dialog).getByRole('alert')).toHaveTextContent('5 MB or smaller');
    expect(within(dialog).getByRole('button', { name: 'Read receipt' })).toBeDisabled();
  });
});
