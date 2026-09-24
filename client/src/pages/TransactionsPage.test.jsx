import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { toLocalDate } from '@/lib/dates';
import { installFakeApi } from '@/test/fakeApi';
import { findToast, renderApp } from '@/test/utils';

const wallets = [
  { name: 'Cash', type: 'cash', icon: 'banknote', openingBalance: 500000 },
  { name: 'HDFC', type: 'bank', openingBalance: 5000000 },
];

const sample = [
  {
    merchant: 'Swiggy',
    amount: 25000,
    category: 'Food & Dining',
    wallet: 'Cash',
    date: '2026-09-20',
  },
  {
    type: 'income',
    merchant: 'Acme Corp',
    amount: 4500000,
    category: 'Salary',
    wallet: 'HDFC',
    date: '2026-09-01',
  },
  {
    merchant: 'BigBasket',
    amount: 180000,
    category: 'Groceries',
    wallet: 'HDFC',
    date: '2026-09-15',
    note: 'monthly shop',
  },
  {
    type: 'transfer',
    amount: 200000,
    wallet: 'HDFC',
    toWallet: 'Cash',
    date: '2026-09-10',
    note: 'ATM',
  },
];

const list = () => screen.findByRole('list', { name: 'Transactions' });
const rowTitles = async () =>
  within(await list())
    .getAllByRole('button', { name: /^Edit / })
    .map((button) => button.getAttribute('aria-label').split(',')[0].replace('Edit ', ''));

async function openAddDialog(user) {
  await user.click((await screen.findAllByRole('button', { name: 'Add transaction' }))[0]);
  return screen.findByRole('dialog', { name: 'Add a transaction' });
}

describe('transactions list', () => {
  it('shows newest first with signed amounts, details and totals', async () => {
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    expect(await rowTitles()).toEqual(['Swiggy', 'BigBasket', 'ATM', 'Acme Corp']);
    const swiggy = within(await list()).getByRole('button', { name: /^Edit Swiggy/ });
    expect(swiggy).toHaveTextContent('Food & Dining · Cash');
    expect(swiggy).toHaveTextContent('−₹250');
    expect(within(await list()).getByRole('button', { name: /^Edit Acme/ })).toHaveTextContent(
      '+₹45,000',
    );
    expect(within(await list()).getByRole('button', { name: /^Edit ATM/ })).toHaveTextContent(
      'HDFC → Cash',
    );

    const totals = screen.getByRole('region', { name: 'Totals' });
    expect(totals).toHaveTextContent('+₹45,000');
    expect(totals).toHaveTextContent('−₹2,050');
    expect(totals).toHaveTextContent('4 transactions');
  });

  it('flags low-confidence AI entries for a second look', async () => {
    installFakeApi({
      wallets,
      transactions: [{ merchant: 'Unclear SMS', amount: 999, source: 'sms', aiConfidence: 0.4 }],
    });
    renderApp('/transactions');
    expect(within(await list()).getByText('Check')).toBeInTheDocument();
  });

  it('searches as you type (after a short pause) and keeps it in the URL', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets, transactions: sample });
    const { router } = renderApp('/transactions');
    await list();

    await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), 'monthly');

    await waitFor(async () => expect(await rowTitles()).toEqual(['BigBasket']));
    expect(router.state.location.search).toBe('?q=monthly');
  });

  it('filters by type', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');
    await list();

    await user.selectOptions(screen.getByLabelText('Type'), 'income');

    await waitFor(async () => expect(await rowTitles()).toEqual(['Acme Corp']));
  });

  it('reads filters from the URL', async () => {
    const api = installFakeApi({ wallets, transactions: sample });
    renderApp(`/transactions?walletId=${api.walletId('Cash')}`);
    await waitFor(async () => expect(await rowTitles()).toEqual(['Swiggy', 'ATM']));
    expect(screen.getByLabelText('Wallet')).toHaveValue(api.walletId('Cash'));
  });

  it('pages through long lists', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 30 }, (_, i) => ({
      merchant: `Shop ${i + 1}`,
      amount: 100,
      date: `2026-08-${String(30 - i).padStart(2, '0')}`,
    }));
    installFakeApi({ wallets, transactions: many });
    renderApp('/transactions');

    expect(await rowTitles()).toHaveLength(25);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(async () => expect(await rowTitles()).toHaveLength(5));
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('explains when nothing matches and offers to clear the filters', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions?q=nothing-like-this');

    expect(await screen.findByText('No matching transactions')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    expect(await rowTitles()).toHaveLength(4);
  });

  it('invites the user to add a first transaction', async () => {
    installFakeApi({ wallets });
    renderApp('/transactions');
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument();
  });
});

describe('adding a transaction', () => {
  it('records an expense with the amount in paise and today’s date', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAddDialog(user);

    await user.type(within(dialog).getByLabelText('Amount'), '249.50');
    await user.selectOptions(
      within(dialog).getByLabelText('Category'),
      api.categoryId('Food & Dining'),
    );
    await user.type(within(dialog).getByLabelText('Where (optional)'), 'Swiggy');
    await user.type(within(dialog).getByLabelText('Tags (optional)'), 'Friends, food, friends');
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await findToast('Transaction added');
    expect(await rowTitles()).toEqual(['Swiggy']);
    expect(api.db.requests.at(-1).body).toEqual({
      type: 'expense',
      amount: 24950,
      walletId: api.walletId('Cash'),
      categoryId: api.categoryId('Food & Dining'),
      date: toLocalDate(new Date(), 'Asia/Kolkata'),
      merchant: 'Swiggy',
      note: '',
      tags: ['friends', 'food'],
    });
  });

  it('only offers categories of the chosen type', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAddDialog(user);

    const categoryNames = () =>
      within(within(dialog).getByLabelText('Category'))
        .getAllByRole('option')
        .map((o) => o.textContent);
    expect(categoryNames()).toEqual(['No category', 'Food & Dining', 'Groceries', 'Transport']);

    await user.click(within(dialog).getByLabelText('Income'));
    expect(categoryNames()).toEqual(['No category', 'Salary', 'Refund']);
  });

  it('records a transfer between two wallets', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAddDialog(user);

    await user.click(within(dialog).getByLabelText('Transfer'));
    await user.type(within(dialog).getByLabelText('Amount'), '1000');
    await user.selectOptions(within(dialog).getByLabelText('From wallet'), api.walletId('HDFC'));
    await user.selectOptions(within(dialog).getByLabelText('To wallet'), api.walletId('Cash'));
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    await findToast('Transaction added');
    expect(api.db.requests.at(-1).body).toMatchObject({
      type: 'transfer',
      amount: 100000,
      walletId: api.walletId('HDFC'),
      toWalletId: api.walletId('Cash'),
    });
    expect(api.db.requests.at(-1).body).not.toHaveProperty('categoryId');
  });

  it('checks the form before sending', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets });
    renderApp('/transactions');
    const dialog = await openAddDialog(user);

    await user.click(within(dialog).getByLabelText('Transfer'));
    await user.selectOptions(within(dialog).getByLabelText('To wallet'), api.walletId('Cash'));
    await user.click(within(dialog).getByRole('button', { name: 'Add transaction' }));

    expect(await within(dialog).findByText('Enter an amount')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a different wallet')).toBeInTheDocument();
    expect(api.db.requests).toHaveLength(0);
  });

  it('asks for a wallet first when there are none', async () => {
    const user = userEvent.setup();
    installFakeApi();
    renderApp('/transactions');
    const dialog = await openAddDialog(user);

    expect(within(dialog).getByText('Add a wallet first')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('link', { name: 'Go to wallets' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Wallets' })).toBeInTheDocument();
  });
});

describe('editing and deleting', () => {
  it('pre-fills the form and sends only what changed', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    await user.click(within(await list()).getByRole('button', { name: /^Edit Swiggy/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' });
    const amount = within(dialog).getByLabelText('Amount');
    expect(amount).toHaveValue('250');
    expect(within(dialog).getByLabelText('Where (optional)')).toHaveValue('Swiggy');

    await user.clear(amount);
    await user.type(amount, '300');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await findToast('Transaction saved');
    expect(api.db.requests.at(-1)).toEqual({
      method: 'PATCH',
      path: `/transactions/${api.db.transactions[0].id}`,
      body: { amount: 30000 },
    });
    await waitFor(async () =>
      expect(within(await list()).getByRole('button', { name: /^Edit Swiggy/ })).toHaveTextContent(
        '−₹300',
      ),
    );
  });

  it('closes without a request when nothing changed', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    await user.click(within(await list()).getByRole('button', { name: /^Edit Swiggy/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit transaction' });
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.db.requests).toHaveLength(0);
  });

  it('deletes after confirming', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets, transactions: sample });
    renderApp('/transactions');

    await user.click(within(await list()).getByRole('button', { name: 'Actions for Swiggy' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete this transaction?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await findToast('Transaction deleted');
    await waitFor(async () => expect(await rowTitles()).toEqual(['BigBasket', 'ATM', 'Acme Corp']));
  });
});
