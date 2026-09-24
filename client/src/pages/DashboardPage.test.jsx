import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { toLocalDate } from '@/lib/dates';
import { installFakeApi } from '@/test/fakeApi';
import { renderApp } from '@/test/utils';

const today = toLocalDate(new Date(), 'Asia/Kolkata');

describe('dashboard', () => {
  it('shows the real total balance and this month’s money in, out and saved', async () => {
    installFakeApi({
      wallets: [
        { name: 'Cash', type: 'cash', openingBalance: 500000 },
        { name: 'HDFC', type: 'bank', openingBalance: 5000000 },
      ],
      transactions: [
        { type: 'income', amount: 4000000, wallet: 'HDFC', date: today },
        { type: 'expense', amount: 1000000, wallet: 'HDFC', date: today },
      ],
    });
    renderApp('/dashboard');

    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(await within(summary).findByText('Across 2 wallets')).toBeInTheDocument();
    // 5,000 + 50,000 + 40,000 − 10,000
    expect(summary).toHaveTextContent('Total balance₹85,000');
    // Month totals arrive in their own request.
    await waitFor(() => expect(summary).toHaveTextContent(/Money in this month₹40,000/));
    expect(summary).toHaveTextContent(/Money out this month₹10,000/);
    expect(summary).toHaveTextContent(/Saved this month₹30,000.*75%/);
  });

  it('keeps the moving background hidden from screen readers', async () => {
    renderApp('/dashboard');
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });
    const aurora = document.querySelector('.aurora-blob').parentElement;
    expect(aurora).toHaveAttribute('aria-hidden', 'true');
  });
});
