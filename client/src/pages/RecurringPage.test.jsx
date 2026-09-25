import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { installFakePlanning } from '@/test/fakePlanning';
import { findToast, renderApp } from '@/test/utils';

function setUp(recurring) {
  const api = installFakeApi({ wallets: [{ name: 'HDFC' }, { name: 'Cash', type: 'cash' }] });
  const [hdfc, cash] = api.db.wallets;
  const rent = api.db.categories.find((c) => c.name === 'Groceries');
  const planning = installFakePlanning({
    recurring: (recurring ?? defaultRules)({ hdfc, cash, rent }),
  });
  return { api, planning, hdfc, cash };
}

const defaultRules = ({ hdfc, cash, rent }) => [
  {
    template: {
      type: 'expense',
      amount: 1500000,
      walletId: hdfc.id,
      categoryId: rent.id,
      merchant: 'Landlord',
    },
    frequency: 'monthly',
    startDate: '2026-01-01',
    nextDate: '2026-10-01',
    upcoming: ['2026-10-01', '2026-11-01', '2026-12-01'],
  },
  {
    template: { type: 'income', amount: 6000000, walletId: hdfc.id, merchant: 'Salary' },
    frequency: 'monthly',
    startDate: '2026-01-30',
    nextDate: '2026-09-30',
  },
  {
    template: { type: 'transfer', amount: 200000, walletId: hdfc.id, toWalletId: cash.id },
    frequency: 'weekly',
    startDate: '2026-09-28',
    active: false,
  },
];

const card = (name) => screen.findByRole('article', { name });

describe('recurring page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T06:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('lists rules with their schedule, next dates and monthly totals', async () => {
    setUp();
    renderApp('/recurring');

    const rent = await card('Landlord');
    expect(rent).toHaveTextContent('Every month on the 1st · HDFC');
    expect(rent).toHaveTextContent('−₹15,000');
    expect(rent).toHaveTextContent('Next:1 Oct 20261 Nov 20261 Dec 2026');

    expect(await card('Salary')).toHaveTextContent('+₹60,000');

    const paused = within(screen.getByRole('region', { name: 'Paused or finished' }));
    expect(paused.getByRole('article', { name: 'Move to Cash' })).toHaveTextContent('Paused');

    const totals = screen.getByRole('region', { name: 'Every month' });
    expect(totals).toHaveTextContent('Money in each month₹60,000');
    expect(totals).toHaveTextContent('Money out each month₹15,000');
  });

  it('adds a recurring payment', async () => {
    const user = userEvent.setup();
    const { planning, hdfc } = setUp(() => []);
    renderApp('/recurring');

    await user.click(await screen.findByRole('button', { name: 'Add recurring payment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a recurring payment' });
    await user.type(within(dialog).getByLabelText('Name'), 'Netflix');
    await user.type(within(dialog).getByLabelText('Amount'), '649');
    await user.clear(within(dialog).getByLabelText('First date'));
    await user.type(within(dialog).getByLabelText('First date'), '2026-10-05');
    expect(within(dialog).getByText('Every month on the 5th')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add recurring payment' }));

    await findToast('Recurring payment added');
    expect(planning.db.requests.at(-1).body).toEqual({
      template: {
        type: 'expense',
        amount: 64900,
        walletId: hdfc.id,
        categoryId: null,
        merchant: 'Netflix',
        note: '',
      },
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-10-05',
      endDate: null,
    });
    expect(await card('Netflix')).toHaveTextContent('Every month on the 5th');
  });

  it('describes a custom schedule as it is typed', async () => {
    const user = userEvent.setup();
    setUp(() => []);
    renderApp('/recurring');

    await user.click(await screen.findByRole('button', { name: 'Add recurring payment' }));
    const dialog = await screen.findByRole('dialog');
    await user.clear(within(dialog).getByLabelText('How many'));
    await user.type(within(dialog).getByLabelText('How many'), '2');
    await user.selectOptions(within(dialog).getByLabelText('How often'), 'weekly');

    expect(within(dialog).getByText('Every 2 weeks on Thursday')).toBeInTheDocument();
  });

  it('checks transfers and end dates before saving', async () => {
    const user = userEvent.setup();
    const { planning } = setUp(() => []);
    renderApp('/recurring');

    await user.click(await screen.findByRole('button', { name: 'Add recurring payment' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText('Type'), 'transfer');
    await user.type(within(dialog).getByLabelText('Amount'), '2000');
    await user.type(within(dialog).getByLabelText('Last date (optional)'), '2026-01-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add recurring payment' }));

    expect(await within(dialog).findByText('Choose a wallet')).toBeInTheDocument();
    expect(within(dialog).getByText('Must be on or after the first date')).toBeInTheDocument();
    expect(planning.db.requests).toHaveLength(0);
  });

  it('pauses and deletes', async () => {
    const user = userEvent.setup();
    const { planning } = setUp();
    renderApp('/recurring');

    await user.click(
      within(await card('Landlord')).getByRole('button', { name: 'Actions for Landlord' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Pause' }));
    await findToast('Paused');
    expect(planning.db.requests.at(-1).body).toEqual({ active: false });
    expect(await card('Landlord')).toHaveTextContent('Paused');

    await user.click(screen.getByRole('button', { name: 'Actions for Move to Cash' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog', { name: 'Delete "Move to Cash"?' });
    await user.click(within(confirm).getByRole('button', { name: 'Delete' }));

    await findToast('Recurring payment deleted');
    expect(screen.queryByRole('article', { name: 'Move to Cash' })).not.toBeInTheDocument();
  });

  it('asks for a wallet first when there are none', async () => {
    installFakeApi();
    installFakePlanning();
    renderApp('/recurring');

    expect(await screen.findByText('Nothing repeats yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a wallet' })).toHaveAttribute('href', '/wallets');
  });
});
