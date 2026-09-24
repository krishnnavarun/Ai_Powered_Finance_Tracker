import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, http, server } from '@/test/msw';
import { installFakeApi } from '@/test/fakeApi';
import { findToast, renderApp } from '@/test/utils';

const wallets = [{ name: 'Cash', type: 'cash', openingBalance: 500000 }];
const sample = [
  { merchant: 'Swiggy', amount: 25000, category: 'Food & Dining', date: '2026-09-20' },
  { merchant: 'BigBasket', amount: 180000, category: 'Groceries', date: '2026-09-15' },
  {
    type: 'income',
    merchant: 'Acme Corp',
    amount: 4500000,
    category: 'Salary',
    date: '2026-09-01',
  },
];

const list = () => screen.findByRole('list', { name: 'Transactions' });
const rowTitles = async () =>
  within(await list())
    .getAllByRole('button', { name: /^Edit / })
    .map((b) => b.getAttribute('aria-label').split(',')[0].replace('Edit ', ''));
const photo = (name = 'bill.png', bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

describe('selecting several transactions', () => {
  it('deletes the selected ones after confirming', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    const idOf = (merchant) => api.db.transactions.find((t) => t.merchant === merchant).id;
    const chosen = [idOf('Swiggy'), idOf('Acme Corp')];
    renderApp('/transactions');

    await user.click(await screen.findByRole('checkbox', { name: 'Select Swiggy' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Acme Corp' }));
    const bar = await screen.findByRole('region', { name: 'Selected transactions' });
    expect(bar).toHaveTextContent('2 selected');

    await user.click(within(bar).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete 2 transactions?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await findToast('Deleted 2 transactions');
    await waitFor(async () => expect(await rowTitles()).toEqual(['BigBasket']));
    expect(api.db.requests.at(-1).body).toEqual({ action: 'delete', ids: chosen });
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Selected transactions' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('selects every row on the page at once, and shows a partial selection', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');
    const selectAll = await screen.findByRole('checkbox', { name: 'Select all on this page' });

    await user.click(selectAll);
    expect(await screen.findByText('3 selected')).toBeInTheDocument();
    expect(selectAll).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('checkbox', { name: 'Select Swiggy' }));
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(selectAll).toHaveAttribute('aria-checked', 'false');
  });

  it('changes the category of the selected ones, skipping other types', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    await user.click(await screen.findByRole('checkbox', { name: 'Select Swiggy' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select Acme Corp' }));
    const bar = await screen.findByRole('region', { name: 'Selected transactions' });
    await user.selectOptions(
      within(bar).getByLabelText('New category for selected'),
      api.categoryId('Groceries'),
    );
    await user.click(within(bar).getByRole('button', { name: 'Apply' }));

    await findToast('Changed 1 · skipped 1 of a different type');
    expect(api.db.requests.at(-1).body).toMatchObject({
      action: 'categorize',
      categoryId: api.categoryId('Groceries'),
    });
  });
});

describe('changing a category in the list', () => {
  it('saves straight away', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    await user.selectOptions(
      await screen.findByLabelText('Category for Swiggy'),
      api.categoryId('Groceries'),
    );

    await findToast('Category changed');
    expect(api.db.requests.at(-1)).toMatchObject({
      method: 'PATCH',
      body: { categoryId: api.categoryId('Groceries') },
    });
  });

  it('only offers categories of the same type', async () => {
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');
    const incomePicker = await screen.findByLabelText('Category for Acme Corp');
    const names = within(incomePicker)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(names).toEqual(['No category', 'Salary', 'Refund']);
  });
});

describe('receipt photos', () => {
  async function openAdd(user) {
    await user.click((await screen.findAllByRole('button', { name: 'Add transaction' }))[0]);
    return screen.findByRole('dialog', { name: 'Add a transaction' });
  }

  it('attaches a photo to a new transaction after saving it', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAdd(user);

    await user.type(within(dialog).getByLabelText('Amount'), '499');
    await user.type(within(dialog).getByLabelText('Where (optional)'), 'DMart');
    await user.upload(within(dialog).getByLabelText('Receipt photo'), photo());
    expect(within(dialog).getByRole('img', { name: 'New receipt' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await findToast('Transaction added');
    const [create, upload] = api.db.requests.slice(-2);
    expect(create.path).toBe('/transactions');
    expect(upload.path).toBe(`/transactions/${api.db.transactions[0].id}/receipt`);
    // (jsdom drops file names when it serialises the form, so only the field is checked;
    // the server never relies on the name — it checks the image bytes.)
    expect(upload.body.field).toBe('receipt');
    expect(await within(await list()).findByLabelText('Has receipt')).toBeInTheDocument();
  });

  it('refuses photos over 5 MB before uploading', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAdd(user);

    await user.upload(
      within(dialog).getByLabelText('Receipt photo'),
      photo('huge.png', 5 * 1024 * 1024 + 1),
    );

    expect(within(dialog).getByText('The photo must be 5 MB or smaller')).toBeInTheDocument();
    expect(within(dialog).queryByRole('img', { name: 'New receipt' })).not.toBeInTheDocument();
  });

  it('shows a saved photo when editing and can remove it', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    const swiggy = api.db.transactions.find((t) => t.merchant === 'Swiggy');
    swiggy.receiptUrl = `/api/transactions/${swiggy.id}/receipt`;
    api.db.receipts.set(swiggy.id, photo());
    renderApp('/transactions');

    await user.click(within(await list()).getByRole('button', { name: /^Edit Swiggy/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' });
    expect(await within(dialog).findByRole('img', { name: 'Saved receipt' })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await findToast('Transaction saved');
    expect(api.db.requests.at(-1)).toEqual({
      method: 'DELETE',
      path: `/transactions/${swiggy.id}/receipt`,
      body: null,
    });
  });

  it('keeps the transaction and says so if only the photo upload fails', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets });
    server.use(
      http.post('*/api/transactions/:id/receipt', () =>
        apiError(413, 'FILE_TOO_LARGE', 'The photo must be 5 MB or smaller'),
      ),
    );
    renderApp('/transactions');
    const dialog = await openAdd(user);

    await user.type(within(dialog).getByLabelText('Amount'), '499');
    await user.upload(within(dialog).getByLabelText('Receipt photo'), photo());
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await findToast(/Transaction saved, but the photo failed/);
    expect(api.db.transactions).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
