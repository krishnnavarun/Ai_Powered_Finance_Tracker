import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { installFakeApi } from '@/test/fakeApi';
import { http, HttpResponse, server } from '@/test/msw';
import { findToast, renderApp } from '@/test/utils';

const ok = (data, status = 200) => HttpResponse.json({ success: true, data }, { status });
const csvFile = (name = 'hdfc.csv') => new File(['Date,Narration\n'], name, { type: 'text/csv' });

const HEADERS = ['Date', 'Narration', 'Withdrawal Amt.', 'Deposit Amt.'];

function setUp() {
  const api = installFakeApi({ wallets: [{ name: 'HDFC' }, { name: 'Cash', type: 'cash' }] });
  const byName = (name) => api.db.categories.find((c) => c.name === name);
  const rows = [
    {
      index: 0,
      line: 6,
      date: '2026-09-01',
      description: 'NEFT CR-ACME CORP-SALARY',
      merchant: 'Acme Corp',
      amount: 6000000,
      type: 'income',
      reference: '',
      categoryId: byName('Salary').id,
      confidence: 0.85,
      via: 'rule',
      duplicate: false,
    },
    {
      index: 1,
      line: 7,
      date: '2026-09-02',
      description: 'UPI/DR/4267/SWIGGY/YESB',
      merchant: 'Swiggy',
      amount: 25000,
      type: 'expense',
      reference: '',
      categoryId: byName('Food & Dining').id,
      confidence: 1,
      via: 'memory',
      duplicate: true,
    },
    {
      index: 2,
      line: 8,
      date: '2026-09-05',
      description: 'POS 4455 TEA STALL',
      merchant: 'Tea Stall',
      amount: 4000,
      type: 'expense',
      reference: '',
      categoryId: null,
      confidence: null,
      via: null,
      duplicate: false,
    },
  ];
  const sent = { previews: [], commits: [] };
  server.use(
    http.post('*/api/import/csv/preview', async ({ request }) => {
      const body = await request.text();
      const mapping = /name="mapping"\r\n\r\n(.*)\r\n/.exec(body)?.[1];
      sent.previews.push(mapping ? JSON.parse(mapping) : null);
      const needsMapping = sent.previews.length === 1 && sent.needsMappingFirst;
      return ok({
        headerIndex: needsMapping ? -1 : 4,
        mapping: needsMapping ? null : { date: 0, description: 1, debit: 2, credit: 3 },
        headers: HEADERS,
        sample: [['01/09/26', 'NEFT CR-ACME CORP-SALARY', '', '60,000.00']],
        needsMapping,
        dayFirst: true,
        rows: needsMapping ? [] : rows,
        skipped: 2,
        usedAI: false,
      });
    }),
    http.post('*/api/import/csv/commit', async ({ request }) => {
      const body = await request.json();
      sent.commits.push(body);
      return ok({ imported: body.rows.length }, 201);
    }),
  );
  return { api, sent, byName };
}

async function readFile(user, name) {
  await user.upload(await screen.findByLabelText('Statement file (CSV)'), csvFile(name));
  await user.click(screen.getByRole('button', { name: 'Read file' }));
}

describe('import page', () => {
  it('previews, lets the user fix rows, and imports the ticked ones', async () => {
    const user = userEvent.setup();
    const { api, sent, byName } = setUp();
    const { router } = renderApp('/transactions');

    await user.click(await screen.findByRole('link', { name: 'Import statement' }));
    await screen.findByRole('heading', { name: 'Import statement' });
    await readFile(user);

    const review = await screen.findByRole('region', { name: 'Review' });
    expect(review).toHaveTextContent('3 payments found');
    expect(review).toHaveTextContent('1 maybe added already (unticked)');
    expect(review).toHaveTextContent('2 lines skipped');

    const list = within(review).getByRole('list', { name: 'Payments to import' });
    expect(within(list).getByRole('checkbox', { name: /Swiggy/ })).not.toBeChecked();
    expect(within(list).getAllByRole('listitem')[0]).toHaveTextContent('+₹60,000');

    await user.selectOptions(
      within(list).getByLabelText('Category for Tea Stall on 2026-09-05'),
      byName('Food & Dining').id,
    );
    await user.click(within(review).getByRole('button', { name: 'Import 2 payments' }));

    await findToast('Imported 2 transactions');
    await waitFor(() => expect(router.state.location.pathname).toBe('/transactions'));
    expect(sent.commits).toEqual([
      {
        walletId: api.db.wallets[0].id,
        keepBalance: true,
        rows: [
          expect.objectContaining({ merchant: 'Acme Corp', type: 'income', amount: 6000000 }),
          expect.objectContaining({
            merchant: 'Tea Stall',
            categoryId: byName('Food & Dining').id,
            note: 'POS 4455 TEA STALL',
            date: '2026-09-05',
          }),
        ],
      },
    ]);
  });

  it('asks which column is which when it can’t tell', async () => {
    const user = userEvent.setup();
    const { sent } = setUp();
    sent.needsMappingFirst = true;
    renderApp('/import');

    await readFile(user);
    const columns = await screen.findByRole('region', { name: 'Columns' });
    expect(within(columns).getByRole('table')).toHaveTextContent('NEFT CR-ACME CORP-SALARY');
    const apply = within(columns).getByRole('button', { name: 'Use these columns' });
    expect(apply).toBeDisabled();

    await user.selectOptions(within(columns).getByLabelText('Date'), '0');
    await user.selectOptions(within(columns).getByLabelText('Description'), '1');
    await user.selectOptions(within(columns).getByLabelText('Money out'), '2');
    await user.selectOptions(within(columns).getByLabelText('Money in'), '3');
    await user.click(apply);

    expect(await screen.findByRole('region', { name: 'Review' })).toHaveTextContent(
      '3 payments found',
    );
    expect(sent.previews[1]).toEqual({
      headerIndex: 0,
      mapping: expect.objectContaining({
        date: 0,
        description: 1,
        debit: 2,
        credit: 3,
        amount: null,
      }),
    });
  });

  it('can add the payments to the balance instead', async () => {
    const user = userEvent.setup();
    const { sent } = setUp();
    renderApp('/import');

    await readFile(user);
    const review = await screen.findByRole('region', { name: 'Review' });
    const keep = within(review).getByRole('checkbox', { name: /Keep the HDFC balance as it is/ });
    expect(keep).toHaveAccessibleName(expect.stringContaining('add ₹59,960 to the balance'));
    await user.click(keep);
    await user.click(within(review).getByRole('button', { name: 'Import 2 payments' }));

    await findToast('Imported 2 transactions');
    expect(sent.commits[0].keepBalance).toBe(false);
  });

  it('refuses Excel files before uploading', async () => {
    const user = userEvent.setup();
    const { sent } = setUp();
    renderApp('/import');

    await user.upload(
      await screen.findByLabelText('Statement file (CSV)'),
      csvFile('statement.xlsx'),
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Save As → CSV');
    expect(screen.getByRole('button', { name: 'Read file' })).toBeDisabled();
    expect(sent.previews).toHaveLength(0);
  });
});
