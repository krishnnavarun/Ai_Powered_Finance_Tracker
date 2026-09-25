import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { installFakePlanning } from '@/test/fakePlanning';
import { emptyForecast, emptyHealth, http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

const ok = (data) => HttpResponse.json({ success: true, data });

const insight = (fields) => ({
  id: fields.dedupeKey,
  type: 'tip',
  severity: 'info',
  title: 'A tip',
  message: 'Do this',
  reason: 'Because of these numbers',
  seen: false,
  dismissed: false,
  createdAt: '2026-09-24T02:00:00.000Z',
  ...fields,
});

function fakeInsights(initial) {
  let list = [...initial];
  const sent = { seen: [], dismissed: [], refreshes: 0 };
  const payload = () => ({
    insights: list.filter((i) => !i.dismissed),
    unseen: list.filter((i) => !i.dismissed && !i.seen).length,
  });
  server.use(
    http.get('*/api/insights', () => ok(payload())),
    http.post('*/api/insights/seen', async ({ request }) => {
      const { ids } = await request.json();
      sent.seen.push(...ids);
      return ok({ updated: ids.length });
    }),
    http.patch('*/api/insights/:id', async ({ params, request }) => {
      const changes = await request.json();
      sent.dismissed.push(params.id);
      list = list.map((i) => (i.id === params.id ? { ...i, ...changes } : i));
      return ok({ insight: list.find((i) => i.id === params.id) });
    }),
    http.post('*/api/insights/refresh', () => {
      sent.refreshes += 1;
      const fresh = insight({ dedupeKey: 'fresh', title: 'Netflix renews soon' });
      list = [fresh, ...list];
      return ok({ created: 1, ...payload() });
    }),
  );
  return sent;
}

describe('insights page', () => {
  it('lists insights, explains them, dismisses and marks them seen', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeInsights([
      insight({
        dedupeKey: 'anomaly',
        type: 'anomaly',
        severity: 'warn',
        title: 'Unusual spending on Food & Dining',
        message: 'You spent ₹6,000 on Food & Dining this week.',
        reason: 'The last 8 weeks averaged ₹1,035.',
      }),
      insight({
        dedupeKey: 'forecast',
        type: 'forecast',
        severity: 'critical',
        title: 'You may run out of money this month',
      }),
    ]);
    renderApp('/insights');

    const anomaly = await screen.findByRole('article', {
      name: 'Unusual spending on Food & Dining',
    });
    expect(anomaly).toHaveTextContent('Heads up');
    expect(anomaly).toHaveTextContent('New');
    expect(
      screen.getByRole('article', { name: 'You may run out of money this month' }),
    ).toHaveTextContent('Important');

    const why = within(anomaly).getByRole('button', { name: 'Why?' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    await user.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    // It fades in.
    await waitFor(() =>
      expect(within(anomaly).getByText('The last 8 weeks averaged ₹1,035.')).toBeVisible(),
    );

    // Seen after a moment on the page.
    await waitFor(() => expect(sent.seen.sort()).toEqual(['anomaly', 'forecast']), {
      timeout: 4000,
    });

    await user.click(
      within(anomaly).getByRole('button', { name: 'Dismiss "Unusual spending on Food & Dining"' }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('article', { name: 'Unusual spending on Food & Dining' }),
      ).not.toBeInTheDocument(),
    );
    expect(sent.dismissed).toEqual(['anomaly']);
  });

  it('checks for new insights on demand', async () => {
    const user = userEvent.setup();
    installFakeApi();
    const sent = fakeInsights([]);
    renderApp('/insights');

    expect(await screen.findByText('No tips yet')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Check now' })[0]);

    await findToast('1 new tip');
    expect(sent.refreshes).toBe(1);
    expect(await screen.findByRole('article', { name: 'Netflix renews soon' })).toBeInTheDocument();
  });
});

describe('dashboard analytics', () => {
  it('shows the month-end forecast with its warning, the health score and the latest tips', async () => {
    installFakeApi();
    fakeInsights([
      insight({ dedupeKey: 'dup', title: 'Charged twice at Swiggy?', severity: 'warn' }),
    ]);
    server.use(
      http.get('*/api/ai/forecast', () =>
        ok({
          ...emptyForecast,
          balance: 1200000,
          predictedEnd: 354375,
          averageDaily: 51229,
          upcomingExpense: 64900,
          warning: 'low',
        }),
      ),
      http.get('*/api/ai/health-score', () => ok({ ...emptyHealth, score: 72, grade: 'Good' })),
    );
    renderApp('/dashboard');

    const forecast = await screen.findByRole('figure', { name: 'Month-end forecast' });
    expect(forecast).toHaveTextContent('Expected balance on 30 Sept 2026');
    expect(forecast).toHaveTextContent('₹3,543.75');
    expect(forecast).toHaveTextContent('Money may run low by month end');
    expect(forecast).toHaveTextContent('about ₹512.29 a day, plus ₹649 of recurring payments');

    const health = screen.getByRole('region', { name: 'Money health' });
    expect(
      within(health).getByRole('img', { name: 'Money health 72 out of 100, Good' }),
    ).toBeInTheDocument();
    // The tip comes from the weakest part.
    expect(health).toHaveTextContent('Tip: Add your income so we can see how much you save.');

    const tips = screen.getByRole('region', { name: 'Tips for you' });
    expect(await within(tips).findByText('Charged twice at Swiggy?')).toBeInTheDocument();
  });
});

describe('subscriptions on the recurring page', () => {
  it('shows what was found and lets the user mark one cancelled', async () => {
    const user = userEvent.setup();
    installFakeApi({ wallets: [{ name: 'HDFC' }] });
    installFakePlanning();
    const statuses = [];
    let netflix = {
      id: 's1',
      merchantKey: 'netflix',
      displayName: 'Netflix',
      avgAmount: 64900,
      period: 'monthly',
      periodDays: 30,
      chargeCount: 4,
      lastChargedAt: '2026-09-05',
      nextExpectedAt: '2026-10-05',
      yearlyCost: 778800,
      status: 'active',
      late: false,
    };
    server.use(
      http.get('*/api/ai/subscriptions', () =>
        ok({
          subscriptions: [netflix],
          totals:
            netflix.status === 'active'
              ? { yearly: 778800, monthly: 64900, count: 1 }
              : { yearly: 0, monthly: 0, count: 0 },
        }),
      ),
      http.patch('*/api/ai/subscriptions/:id', async ({ request }) => {
        const { status } = await request.json();
        statuses.push(status);
        netflix = { ...netflix, status };
        return ok({ subscription: netflix });
      }),
    );
    renderApp('/recurring');

    const found = await screen.findByRole('region', { name: 'Subscriptions found' });
    expect(found).toHaveTextContent('₹7,788 a year on 1 subscription');
    const card = within(found).getByRole('listitem', { name: 'Netflix' });
    expect(card).toHaveTextContent('₹649 every month · 4 charges · next around 5 Oct 2026');

    await user.click(within(card).getByRole('button', { name: 'I cancelled it' }));

    await findToast('Marked Netflix as cancelled');
    expect(statuses).toEqual(['cancelled']);
    expect(await within(found).findByText('Cancelled')).toBeInTheDocument();
    expect(within(found).getByRole('button', { name: 'Undo' })).toBeInTheDocument();
  });
});

describe('budget autopilot', () => {
  it('suggests budgets and sets the chosen ones', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    const byName = (name) => api.db.categories.find((c) => c.name === name);
    const planning = installFakePlanning({
      budgets: [{ categoryId: byName('Groceries').id, limit: 300000 }],
    });
    server.use(
      http.get('*/api/ai/budget-suggestions', () =>
        ok({
          basedOn: ['2026-06', '2026-07', '2026-08'],
          monthsWithData: 3,
          forMonth: '2026-09',
          income: 4000000,
          projectedSavingsRate: 20,
          reachesTarget: true,
          suggestions: [
            {
              categoryId: byName('Food & Dining').id,
              kind: 'want',
              median: 900000,
              suggested: 630000,
              trimmedBy: 270000,
            },
            {
              categoryId: byName('Groceries').id,
              kind: 'need',
              median: 410000,
              suggested: 400000,
              trimmedBy: 10733,
            },
            {
              categoryId: byName('Transport').id,
              kind: 'need',
              median: 200000,
              suggested: 200000,
              trimmedBy: 0,
            },
          ],
        }),
      ),
    );
    renderApp('/budgets');

    await user.click(await screen.findByRole('button', { name: 'Suggest budgets' }));
    const dialog = await screen.findByRole('dialog', { name: 'Suggested budgets' });
    expect(dialog).toHaveTextContent('Based on your spending in Jun, Jul, Aug');
    const list = await within(dialog).findByRole('list', { name: 'Suggested budgets' });
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent(
      'Food & DiningWantUsually ₹9,000 a month, trimmed by ₹2,700₹6,300',
    );
    expect(dialog).toHaveTextContent("you'd save about 20% of your ₹40,000 income");

    await user.click(within(list).getByRole('checkbox', { name: 'Budget for Transport' }));
    await user.click(within(dialog).getByRole('button', { name: /^Set 2 budgets for/ }));

    await findToast('Set 2 budgets');
    const writes = planning.db.requests.filter((r) => r.path.startsWith('/budgets'));
    // Food is new; Groceries already had a budget, so its limit is updated.
    expect(writes.map((w) => [w.method, w.body])).toEqual([
      ['POST', { month: '2026-09', categoryId: byName('Food & Dining').id, limit: 630000 }],
      ['PATCH', { limit: 400000 }],
    ]);
  });
});

describe('what-if on goals', () => {
  it('shows new savings and how much sooner goals are reached', async () => {
    const api = installFakeApi();
    const food = api.db.categories.find((c) => c.name === 'Food & Dining');
    installFakePlanning({ goals: [{ name: 'Bike', targetAmount: 15000000 }] });
    const asked = [];
    server.use(
      http.post('*/api/ai/what-if', async ({ request }) => {
        const { changes } = await request.json();
        asked.push(changes);
        const percent = changes[0].changePercent;
        const after = 900000 * (1 + percent / 100);
        return ok({
          basedOn: ['2026-06', '2026-07', '2026-08'],
          before: { expense: 2400000, savings: 3600000 },
          after: { expense: 1500000 + after, savings: 4500000 - after },
          savingsChange: 900000 - after,
          yearlySavingsChange: (900000 - after) * 12,
          changes: [
            {
              categoryId: food.id,
              changePercent: percent,
              before: 900000,
              after,
              difference: after - 900000,
            },
          ],
          goals: [
            {
              goalId: 'g1',
              name: 'Bike',
              remaining: 15000000,
              before: { months: 5, date: '2027-02-24' },
              after: { months: 4, date: '2027-01-24' },
              monthsSooner: 1,
            },
          ],
        });
      }),
    );
    renderApp('/goals');

    const panel = await screen.findByRole('region', { name: 'What if' });
    expect(within(panel).getByLabelText('I change my spending on')).toHaveDisplayValue(
      'Food & Dining',
    );
    expect(
      await within(panel).findByText(/Spending ₹7,200 instead of ₹9,000 a month/),
    ).toBeInTheDocument();
    expect(panel).toHaveTextContent('save ₹1,800 more a month (₹21,600 a year)');
    expect(panel).toHaveTextContent('BikeBy January 2027, 1 month sooner');
    expect(asked[0]).toEqual([{ categoryId: food.id, changePercent: -20 }]);

    // Move the slider to −50% (jsdom can't drag, so set the value like a browser would).
    fireEvent.change(within(panel).getByRole('slider'), { target: { value: '-50' } });
    await waitFor(() =>
      expect(asked.at(-1)).toEqual([{ categoryId: food.id, changePercent: -50 }]),
    );
    expect(await within(panel).findByText(/Spending ₹4,500 instead of ₹9,000/)).toBeInTheDocument();
  });
});
