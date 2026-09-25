import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

// Records the query of every report request, and answers with fixed numbers.
function fakeReports() {
  const seen = [];
  const ok = (data) => HttpResponse.json({ success: true, data });
  const log = (name) => (request) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    seen.push({ name, ...params });
    return params;
  };
  server.use(
    http.get('*/api/reports/summary', ({ request }) => {
      const { from, to } = log('summary')(request);
      return ok({
        from,
        to,
        income: 4000000,
        expense: 1320000,
        saved: 2680000,
        savingsRate: 67,
        transactionCount: 4,
        days: 24,
        avgDailySpend: 55000,
        biggestExpense: { merchant: 'Landlord', amount: 1200000, date: '2026-09-01T18:30:00.000Z' },
      });
    }),
    http.get('*/api/reports/by-category', ({ request }) => {
      log('by-category')(request);
      return ok({
        total: 1320000,
        categories: [
          { categoryId: 'r', name: 'Rent', icon: 'house', total: 1200000, count: 1, percent: 90.9 },
          {
            categoryId: 'g',
            name: 'Groceries',
            icon: 'shopping-basket',
            total: 120000,
            count: 1,
            percent: 9.1,
          },
        ],
      });
    }),
    http.get('*/api/reports/merchants', ({ request }) => {
      log('merchants')(request);
      return ok({ merchants: [{ merchantKey: 'dmart', name: 'DMart', total: 90000, count: 3 }] });
    }),
    http.get('*/api/reports/by-wallet', ({ request }) => {
      log('by-wallet')(request);
      return ok({
        wallets: [{ walletId: 'w', name: 'HDFC', icon: 'landmark', income: 0, expense: 116000 }],
      });
    }),
    http.get('*/api/reports/export', ({ request }) => {
      const { format } = log('export')(request);
      return new HttpResponse('Date,Type\r\n', {
        headers: {
          'Content-Type': format === 'pdf' ? 'application/pdf' : 'text/csv',
          'Content-Disposition': `attachment; filename="paisa-pal-2026-09-01-to-2026-09-30.${format}"`,
        },
      });
    }),
  );
  return seen;
}

describe('reports page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-24T06:30:00Z')); // 24 Sep 2026 in India
  });
  afterEach(() => vi.useRealTimers());

  it('shows this month’s summary, biggest payment and breakdown', async () => {
    fakeReports();
    renderApp('/reports');

    const summary = await screen.findByRole('region', { name: 'Summary' });
    expect(summary).toHaveTextContent('Money in₹40,000');
    expect(summary).toHaveTextContent('Money out₹13,200');
    expect(summary).toHaveTextContent(/Saved₹26,800.*67%/);
    expect(summary).toHaveTextContent('Spent per day (average)₹550');
    expect(screen.getByText(/Biggest payment:/)).toHaveTextContent('₹12,000 at Landlord');

    const categories = await screen.findByRole('list', { name: 'Spending by categories' });
    expect(within(categories).getAllByRole('listitem')[0]).toHaveTextContent('Rent₹12,00090.9%');
  });

  it('switches between categories, places and wallets', async () => {
    const user = userEvent.setup();
    fakeReports();
    renderApp('/reports');
    await screen.findByRole('list', { name: 'Spending by categories' });

    await user.click(screen.getByRole('tab', { name: 'Places' }));
    expect(await screen.findByRole('list', { name: 'Spending by places' })).toHaveTextContent(
      'DMart₹9003×',
    );

    await user.click(screen.getByRole('tab', { name: 'Wallets' }));
    expect(await screen.findByRole('list', { name: 'Spending by wallets' })).toHaveTextContent(
      'HDFC₹1,160',
    );
  });

  it('asks for the chosen period and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const seen = fakeReports();
    const { router } = renderApp('/reports');
    await screen.findByRole('region', { name: 'Summary' });
    expect(seen.find((r) => r.name === 'summary')).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });

    await user.click(screen.getByRole('radio', { name: 'Last 3 months' }));

    await waitFor(() =>
      expect(seen.filter((r) => r.name === 'summary').at(-1)).toMatchObject({
        from: '2026-07-01',
        to: '2026-09-30',
      }),
    );
    expect(router.state.location.search).toBe('?period=last-3-months');
    expect(screen.getByRole('radio', { name: 'Last 3 months' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('downloads the report as CSV or PDF with the server’s file name', async () => {
    const user = userEvent.setup();
    const seen = fakeReports();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/reports');
    await screen.findByRole('region', { name: 'Summary' });

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await findToast('Downloaded paisa-pal-2026-09-01-to-2026-09-30.pdf');
    expect(click).toHaveBeenCalledTimes(1);
    expect(click.mock.instances[0].download).toBe('paisa-pal-2026-09-01-to-2026-09-30.pdf');
    expect(seen.find((r) => r.name === 'export')).toMatchObject({
      format: 'pdf',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    click.mockRestore();
  });
});
