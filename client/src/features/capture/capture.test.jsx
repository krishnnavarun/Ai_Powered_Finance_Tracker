import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { apiError, http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

const ok = (data) => HttpResponse.json({ success: true, data });

function setUp() {
  const api = installFakeApi({
    wallets: [
      { name: 'Cash', type: 'cash' },
      { name: 'GPay', type: 'upi' },
    ],
  });
  const [cash, gpay] = api.db.wallets;
  const food = api.db.categories.find((c) => c.name === 'Food & Dining');
  return { api, cash, gpay, food };
}

// Answers POST /ai/parse/text with a draft built from the given fields.
function fakeParseText(draft) {
  const sent = [];
  server.use(
    http.post('*/api/ai/parse/text', async ({ request }) => {
      sent.push((await request.json()).text);
      return ok({
        usedAI: true,
        draft: {
          type: 'expense',
          toWalletId: null,
          note: '',
          source: 'nl',
          aiConfidence: 0.92,
          ...draft,
        },
      });
    }),
  );
  return sent;
}

describe('adding by typing', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('fills the form from the dashboard bar and saves it with its source', async () => {
    const user = userEvent.setup();
    const { api, gpay, food } = setUp();
    const sent = fakeParseText({
      amount: 25000,
      walletId: gpay.id,
      categoryId: food.id,
      merchant: 'Biryani House',
      date: '2026-09-23',
    });
    renderApp('/dashboard');

    await user.type(
      await screen.findByLabelText('Describe a payment'),
      'spent 250 on biryani yesterday from GPay{Enter}',
    );

    const dialog = await screen.findByRole('dialog', { name: 'Add a transaction' });
    expect(sent).toEqual(['spent 250 on biryani yesterday from GPay']);
    expect(within(dialog).getByRole('status')).toHaveTextContent('Filled in for you');
    expect(within(dialog).getByLabelText('Amount')).toHaveValue('250');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-23');
    expect(within(dialog).getByLabelText('Wallet')).toHaveDisplayValue('GPay');
    expect(within(dialog).getByLabelText('Category')).toHaveDisplayValue('Food & Dining');
    expect(within(dialog).getByLabelText('Where (optional)')).toHaveValue('Biryani House');

    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await findToast('Transaction added');
    expect(api.db.requests.at(-1).body).toMatchObject({
      amount: 25000,
      walletId: gpay.id,
      categoryId: food.id,
      date: '2026-09-23',
      source: 'nl',
      aiConfidence: 0.92,
    });
  });

  it('asks the user to check a draft it is unsure about', async () => {
    const user = userEvent.setup();
    const { cash } = setUp();
    fakeParseText({ amount: 18000, walletId: cash.id, categoryId: null, aiConfidence: 0.5 });
    renderApp('/transactions');

    await user.click(await screen.findByRole('button', { name: /add transaction/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('tab', { name: 'Type it' }));
    await user.click(within(dialog).getByRole('button', { name: 'uber 180 last friday' }));
    expect(within(dialog).getByLabelText('Describe the payment')).toHaveValue(
      'uber 180 last friday',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Fill in the form' }));

    expect(await within(dialog).findByRole('tab', { name: 'Manual' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent('some details may be wrong');
    expect(within(dialog).getByLabelText('Amount')).toHaveValue('180');
  });

  it('shows why nothing could be read', async () => {
    const user = userEvent.setup();
    setUp();
    server.use(
      http.post('*/api/ai/parse/text', () =>
        apiError(
          422,
          'NOTHING_FOUND',
          'Could not find an amount. Try something like "spent 250 on lunch".',
        ),
      ),
    );
    renderApp('/dashboard');

    await user.type(await screen.findByLabelText('Describe a payment'), 'bought lunch{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not find an amount');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('adding from SMS', () => {
  it('reviews what was found and adds the ticked payments', async () => {
    const user = userEvent.setup();
    const { api, cash, gpay, food } = setUp();
    const draft = (fields) => ({
      type: 'expense',
      toWalletId: null,
      categoryId: null,
      note: '',
      date: '2026-09-24',
      source: 'sms',
      aiConfidence: 0.9,
      ...fields,
    });
    server.use(
      http.post('*/api/ai/parse/sms', () =>
        ok({
          usedAI: false,
          items: [
            {
              index: 0,
              text: 'Rs.250 debited to SWIGGY',
              status: 'ready',
              via: 'regex',
              possibleDuplicate: false,
              draft: draft({
                amount: 25000,
                merchant: 'Swiggy',
                walletId: gpay.id,
                categoryId: food.id,
              }),
            },
            {
              index: 1,
              text: 'Rs.99 debited to JIO',
              status: 'ready',
              via: 'regex',
              possibleDuplicate: true,
              draft: draft({ amount: 9900, merchant: 'Jio', walletId: gpay.id }),
            },
            {
              index: 2,
              text: 'Txn of Rs 349 at Chaayos',
              status: 'ready',
              via: 'ai',
              possibleDuplicate: false,
              draft: draft({
                amount: 34900,
                merchant: 'Chaayos',
                walletId: null,
                aiConfidence: 0.6,
              }),
            },
            { index: 3, text: '123456 is your OTP', status: 'skipped', reason: 'otp' },
          ],
        }),
      ),
    );
    renderApp('/transactions');

    await user.click(await screen.findByRole('button', { name: /add transaction/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('tab', { name: 'Paste SMS' }));
    await user.type(within(dialog).getByLabelText('Paste bank SMS'), 'Rs.250 debited to SWIGGY');
    await user.click(within(dialog).getByRole('button', { name: 'Read messages' }));

    const found = await within(dialog).findByRole('region', { name: 'Payments found' });
    expect(found).toHaveTextContent('Found 3 payments');
    // The possible duplicate starts unticked.
    expect(within(found).getByRole('checkbox', { name: 'Add Jio' })).not.toBeChecked();
    expect(within(found).getByText('Maybe added already')).toBeInTheDocument();
    expect(within(dialog).getByText('Skipped 1 message')).toBeInTheDocument();

    // Chaayos has no wallet yet, so adding waits for one.
    const add = within(dialog).getByRole('button', { name: 'Add 2 transactions' });
    expect(add).toBeDisabled();
    await user.selectOptions(within(found).getByLabelText('Wallet for Chaayos'), cash.id);
    await user.click(add);

    await findToast('Added 2 transactions');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const posted = api.db.requests.filter((r) => r.path === '/transactions').map((r) => r.body);
    expect(posted).toEqual([
      expect.objectContaining({
        merchant: 'Swiggy',
        walletId: gpay.id,
        categoryId: food.id,
        source: 'sms',
      }),
      expect.objectContaining({
        merchant: 'Chaayos',
        walletId: cash.id,
        amount: 34900,
        aiConfidence: 0.6,
      }),
    ]);
  });
});
