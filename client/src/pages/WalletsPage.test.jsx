import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { findToast, renderApp } from '@/test/utils';

const threeWallets = [
  { name: 'Cash', type: 'cash', icon: 'banknote', openingBalance: 500000 },
  { name: 'HDFC', type: 'bank', openingBalance: 5000000 },
  {
    name: 'ICICI Card',
    type: 'card',
    icon: 'credit-card',
    openingBalance: -1200000,
    creditLimit: 10000000,
  },
];

const card = (name) => screen.findByRole('article', { name });

async function openAddWallet(user) {
  await user.click(await screen.findByRole('button', { name: 'Add wallet' }));
  return screen.findByRole('dialog', { name: 'Add a wallet' });
}

describe('wallets page', () => {
  it('shows each wallet with its balance and the total', async () => {
    installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');

    expect(await card('Cash')).toHaveTextContent('₹5,000');
    expect(await card('HDFC')).toHaveTextContent('₹50,000');
    const icici = await card('ICICI Card');
    expect(icici).toHaveTextContent('You owe');
    expect(icici).toHaveTextContent('-₹12,000');
    expect(icici).toHaveTextContent('₹88,000 available of ₹1,00,000');
    // 5,000 + 50,000 − 12,000
    expect(screen.getByRole('region', { name: 'Total' })).toHaveTextContent('₹43,000');
  });

  it('invites the user to add a first wallet', async () => {
    installFakeApi();
    renderApp('/wallets');
    expect(await screen.findByText('Add your first wallet')).toBeInTheDocument();
  });

  it('adds a wallet with the amount converted to paise', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    renderApp('/wallets');
    const dialog = await openAddWallet(user);

    await user.type(within(dialog).getByLabelText('Name'), 'Cash');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'cash');
    await user.type(within(dialog).getByLabelText('Current balance'), '2,500.50');
    await user.click(within(dialog).getByRole('button', { name: 'Add wallet' }));

    expect(await findToast('Added "Cash"')).toBeInTheDocument();
    expect(await card('Cash')).toHaveTextContent('₹2,500.50');
    expect(api.db.requests.at(-1).body).toEqual({
      name: 'Cash',
      type: 'cash',
      icon: 'banknote',
      color: '#0f766e',
      openingBalance: 250050,
      creditLimit: null,
    });
  });

  it('checks the form before saving', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    renderApp('/wallets');
    const dialog = await openAddWallet(user);

    await user.type(within(dialog).getByLabelText('Current balance'), '12.345');
    await user.click(within(dialog).getByRole('button', { name: 'Add wallet' }));

    expect(await within(dialog).findByText('Give the wallet a name')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter an amount like 2,500.50')).toBeInTheDocument();
    expect(api.db.requests).toHaveLength(0);
  });

  it('shows a duplicate name under the name field', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');
    const dialog = await openAddWallet(user);

    await user.type(within(dialog).getByLabelText('Name'), 'cash');
    await user.click(within(dialog).getByRole('button', { name: 'Add wallet' }));

    expect(
      await within(dialog).findByText('You already have a wallet named "cash"'),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
  });

  it('only asks for a credit limit for cards', async () => {
    const user = userEvent.setup();
    installFakeApi();
    renderApp('/wallets');
    const dialog = await openAddWallet(user);

    expect(within(dialog).queryByLabelText('Credit limit')).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'card');
    expect(within(dialog).getByLabelText('Credit limit')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Amount owed now')).toBeInTheDocument();
  });

  it('edits a wallet with its current values pre-filled', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');

    await user.click(within(await card('HDFC')).getByRole('button', { name: 'Actions for HDFC' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit wallet' });

    expect(within(dialog).getByLabelText('Current balance')).toHaveValue('50000');
    const name = within(dialog).getByLabelText('Name');
    await user.clear(name);
    await user.type(name, 'HDFC Salary');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    expect(await card('HDFC Salary')).toBeInTheDocument();
    expect(api.db.requests.at(-1)).toMatchObject({
      method: 'PATCH',
      body: { name: 'HDFC Salary' },
    });
  });

  it('archives a wallet, with undo', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');

    await user.click(within(await card('Cash')).getByRole('button', { name: 'Actions for Cash' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Archive' }));

    expect(await findToast('Archived "Cash"')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Cash' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await card('Cash')).toBeInTheDocument();
  });

  it('shows archived wallets on request', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [...threeWallets, { name: 'Old Bank', isArchived: true }] });
    renderApp('/wallets');
    await card('Cash');
    expect(screen.queryByRole('article', { name: 'Old Bank' })).not.toBeInTheDocument();

    await user.click(screen.getByLabelText('Show archived wallets'));

    expect(await card('Old Bank')).toHaveTextContent('Archived');
  });

  it('explains why a wallet with transactions cannot be deleted', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: threeWallets, transactions: [{ wallet: 'Cash', amount: 100 }] });
    renderApp('/wallets');

    await user.click(within(await card('Cash')).getByRole('button', { name: 'Actions for Cash' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete "Cash"?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(await findToast(/This wallet has transactions/)).toBeInTheDocument();
    expect(await card('Cash')).toBeInTheDocument();
  });

  it('moves money between wallets and updates both balances', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');

    await user.click(await screen.findByRole('button', { name: 'Move money' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move money' });
    await user.selectOptions(within(dialog).getByLabelText('From'), api.walletId('HDFC'));
    await user.selectOptions(within(dialog).getByLabelText('To'), api.walletId('Cash'));
    await user.type(within(dialog).getByLabelText('Amount'), '2000');
    await user.click(within(dialog).getByRole('button', { name: 'Move money' }));

    expect(await findToast('Moved ₹2,000')).toBeInTheDocument();
    await waitFor(async () => expect(await card('Cash')).toHaveTextContent('₹7,000'));
    expect(await card('HDFC')).toHaveTextContent('₹48,000');
  });

  it('will not move money to the same wallet', async () => {
    const user = userEvent.setup();
    const api = installFakeApi({ wallets: threeWallets });
    renderApp('/wallets');

    await user.click(await screen.findByRole('button', { name: 'Move money' }));
    const dialog = await screen.findByRole('dialog', { name: 'Move money' });
    await user.selectOptions(within(dialog).getByLabelText('To'), api.walletId('Cash'));
    await user.selectOptions(within(dialog).getByLabelText('From'), api.walletId('Cash'));
    await user.type(within(dialog).getByLabelText('Amount'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Move money' }));

    expect(await within(dialog).findByText('Choose a different wallet')).toBeInTheDocument();
  });
});
