import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { installFakePlanning } from '@/test/fakePlanning';
import { renderApp } from '@/test/utils';

const trend = [
  ['2026-04', 3000000, 2000000],
  ['2026-05', 3000000, 2500000],
  ['2026-06', 3200000, 2100000],
  ['2026-07', 3200000, 3400000],
  ['2026-08', 3500000, 2000000],
  ['2026-09', 4000000, 1000000],
].map(([month, income, expense]) => ({ month, income, expense, saved: income - expense }));

describe('dashboard', () => {
  it('shows the balance, this month’s numbers and every section', async () => {
    const api = installFakeApi({
      wallets: [
        { name: 'Cash', type: 'cash', openingBalance: 500000 },
        { name: 'HDFC', type: 'bank', openingBalance: 5000000 },
      ],
      transactions: [
        { merchant: 'Swiggy', amount: 25000, wallet: 'Cash', category: 'Food & Dining' },
      ],
    });
    installFakePlanning({
      trend,
      byCategory: {
        total: 1000000,
        categories: [
          {
            categoryId: api.categoryId('Groceries'),
            name: 'Groceries',
            icon: 'shopping-basket',
            total: 600000,
            count: 3,
            percent: 60,
          },
          {
            categoryId: api.categoryId('Food & Dining'),
            name: 'Food & Dining',
            icon: 'utensils',
            total: 400000,
            count: 5,
            percent: 40,
          },
        ],
      },
      budgets: [
        { categoryId: api.categoryId('Food & Dining'), limit: 500000, spent: 100000 },
        { categoryId: api.categoryId('Groceries'), limit: 500000, spent: 600000 },
      ],
      goals: [{ name: 'New phone', targetAmount: 6000000, savedAmount: 1500000, monthsLeft: 4 }],
    });
    renderApp('/dashboard');

    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(await within(summary).findByText('Across 2 wallets')).toBeInTheDocument();
    expect(summary).toHaveTextContent('Total balance₹54,750'); // 5,000 + 50,000 − 250
    expect(summary).toHaveTextContent(/Money in this month₹40,000/);
    expect(summary).toHaveTextContent(/Money out this month₹10,000/);
    expect(summary).toHaveTextContent(/Saved this month₹30,000.*75%/);

    // Trend: the numbers are also in a table for screen readers.
    const table = screen.getByRole('table', { name: 'Money in and out by month' });
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(table).getByRole('row', { name: /July 2026/ })).toHaveTextContent('₹34,000');

    const spending = screen.getByRole('region', { name: 'Where your money went' });
    expect(spending).toHaveTextContent('Groceries₹6,00060%');

    // Budgets: the one that is over comes first.
    const budgets = screen.getByRole('region', { name: 'Budgets' });
    const names = within(budgets)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(names[0]).toMatch(/^GroceriesOver budget/);

    expect(screen.getByRole('region', { name: 'Goals' })).toHaveTextContent('Save ₹11,250 a month');
    expect(
      await within(screen.getByRole('region', { name: 'Recent' })).findByText('Swiggy'),
    ).toBeInTheDocument();
  });

  it('invites a new user to get started in each section', async () => {
    installFakeApi();
    renderApp('/dashboard');

    expect(await screen.findByText('No spending yet this month.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Set a budget' })).toHaveAttribute('href', '/budgets');
    expect(screen.getByRole('link', { name: 'Add a goal' })).toHaveAttribute('href', '/goals');
    expect(screen.getByRole('link', { name: 'Add a payment' })).toHaveAttribute(
      'href',
      '/transactions',
    );
  });

  it('keeps the moving background hidden from screen readers', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    const aurora = document.querySelector('.aurora-blob').parentElement;
    expect(aurora).toHaveAttribute('aria-hidden', 'true');
  });
});
