import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { installFakePlanning } from '@/test/fakePlanning';
import { findToast, renderApp } from '@/test/utils';

function setUp({ budgets, previousBudgets } = {}) {
  const api = installFakeApi({ wallets: [{ name: 'HDFC' }] });
  const food = api.categoryId('Food & Dining');
  const groceries = api.categoryId('Groceries');
  const planning = installFakePlanning({
    budgets: budgets ?? [
      { categoryId: null, limit: 600000, spent: 600000 },
      { categoryId: food, limit: 500000, spent: 350000 },
      { categoryId: groceries, limit: 200000, spent: 250000 },
    ],
    // May be a function of the category ids, which only exist once the fake API is set up.
    previousBudgets:
      typeof previousBudgets === 'function'
        ? previousBudgets({ food, groceries })
        : previousBudgets,
  });
  return { api, planning, food, groceries };
}

const card = (name) => screen.findByRole('article', { name });

describe('budgets page', () => {
  it('shows each budget with its status in words, not just colour', async () => {
    setUp();
    renderApp('/budgets');

    const food = await card('Food & Dining');
    expect(food).toHaveTextContent('On track');
    expect(food).toHaveTextContent('₹3,500 of ₹5,000');
    expect(food).toHaveTextContent('₹1,500 left · about ₹214.28 a day for 7 days');
    expect(within(food).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');

    const groceries = await card('Groceries');
    expect(groceries).toHaveTextContent('Over budget');
    expect(groceries).toHaveTextContent('Over by ₹500');

    expect(await card('Overall budget')).toHaveTextContent('Over budget');
    expect(screen.getByRole('region', { name: 'This month' })).toHaveTextContent('₹6,000');
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });

  it('adds a budget, offering only categories without one', async () => {
    const user = userEvent.setup();
    const { api, planning } = setUp();
    renderApp('/budgets');

    await user.click(await screen.findByRole('button', { name: 'Add budget' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a budget' });
    const picker = within(dialog).getByLabelText('Budget for');
    const offered = within(picker)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(offered).toEqual(['Choose…', 'Transport']); // Food, Groceries and Overall are taken

    await user.selectOptions(picker, api.categoryId('Transport'));
    await user.type(within(dialog).getByLabelText('Monthly limit'), '3,000');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Carry over unspent money' }));
    await user.click(within(dialog).getByRole('button', { name: 'Add budget' }));

    await findToast('Budget added');
    expect(planning.db.requests.at(-1).body).toEqual({
      month: '2026-09',
      categoryId: api.categoryId('Transport'),
      limit: 300000,
      rollover: true,
    });
    expect(await card('Transport')).toBeInTheDocument();
  });

  it('asks what the budget is for', async () => {
    const user = userEvent.setup();
    setUp({ budgets: [] });
    renderApp('/budgets');

    await user.click((await screen.findAllByRole('button', { name: 'Add budget' }))[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Add a budget' });
    await user.type(within(dialog).getByLabelText('Monthly limit'), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Add budget' }));

    expect(await within(dialog).findByText('Choose what this budget is for')).toBeInTheDocument();
  });

  it('edits the limit of a budget', async () => {
    const user = userEvent.setup();
    const { planning } = setUp();
    renderApp('/budgets');

    await user.click(
      within(await card('Food & Dining')).getByRole('button', {
        name: 'Actions for Food & Dining',
      }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit budget' });
    const limit = within(dialog).getByLabelText('Monthly limit');
    expect(limit).toHaveValue('5000');
    await user.clear(limit);
    await user.type(limit, '6000');
    await user.click(within(dialog).getByRole('button', { name: 'Save budget' }));

    await findToast('Budget saved');
    expect(planning.db.requests.at(-1)).toMatchObject({
      method: 'PATCH',
      body: { limit: 600000, rollover: false },
    });
  });

  it('deletes a budget after confirming', async () => {
    const user = userEvent.setup();
    setUp();
    renderApp('/budgets');

    await user.click(
      within(await card('Groceries')).getByRole('button', { name: 'Actions for Groceries' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Delete this budget?' })).getByRole(
        'button',
        {
          name: 'Delete',
        },
      ),
    );

    await findToast('Budget deleted');
    await waitFor(() =>
      expect(screen.queryByRole('article', { name: 'Groceries' })).not.toBeInTheDocument(),
    );
  });

  it('moves between months', async () => {
    const user = userEvent.setup();
    setUp();
    renderApp('/budgets');
    await card('Food & Dining');

    await user.click(screen.getByRole('button', { name: 'Previous month' }));

    expect(await screen.findByText('No budgets for August 2026')).toBeInTheDocument();
  });

  it('copies last month’s budgets into an empty month', async () => {
    const user = userEvent.setup();
    const { planning, food, groceries } = setUp({
      budgets: [],
      previousBudgets: (ids) => [
        { id: 'a', categoryId: ids.food, limit: 400000, alertLevels: [80, 100], rollover: true },
        {
          id: 'b',
          categoryId: ids.groceries,
          limit: 150000,
          alertLevels: [80, 100],
          rollover: false,
        },
      ],
    });
    renderApp('/budgets');

    await user.click(await screen.findByRole('button', { name: 'Copy last month’s budgets' }));

    await findToast('Copied 2 budgets');
    expect(planning.db.requests.map((r) => r.body)).toEqual([
      { month: '2026-09', categoryId: food, limit: 400000, alertLevels: [80, 100], rollover: true },
      {
        month: '2026-09',
        categoryId: groceries,
        limit: 150000,
        alertLevels: [80, 100],
        rollover: false,
      },
    ]);
  });
});
