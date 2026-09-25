import PDFDocument from 'pdfkit';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import { localDateOf } from '../utils/dates.js';
import { formatRupees, toRupeeString } from '../utils/money.js';
import {
  resolveRange,
  reportSummary,
  spendingByCategory,
  topMerchants,
} from './reports.service.js';

// Every transaction in the period, oldest first, with category and wallet names filled in.
async function rowsFor(userId, range) {
  const [transactions, categories, wallets] = await Promise.all([
    Transaction.find({ userId, date: { $gte: range.start, $lt: range.end } })
      .sort({ date: 1, _id: 1 })
      .lean(),
    Category.find({ userId }).select('name').lean(),
    Wallet.find({ userId }).select('name').lean(),
  ]);
  const categoryName = new Map(categories.map((c) => [String(c._id), c.name]));
  const walletName = new Map(wallets.map((w) => [String(w._id), w.name]));

  return transactions.map((txn) => ({
    date: localDateOf(txn.date, range.prefs.timeZone),
    type: txn.type,
    amount: txn.amount,
    category: txn.categoryId ? (categoryName.get(String(txn.categoryId)) ?? '') : '',
    wallet: walletName.get(String(txn.walletId)) ?? '',
    toWallet: txn.toWalletId ? (walletName.get(String(txn.toWalletId)) ?? '') : '',
    merchant: txn.merchant,
    note: txn.note,
    tags: txn.tags.join(', '),
  }));
}

// ---- CSV ------------------------------------------------------------------------------

// Spreadsheet apps run cells that start with = + - @ as formulas; a merchant named
// "=HYPERLINK(...)" could do harm. Such text gets a leading ' so it stays plain text.
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Byte-order mark: tells Excel the file is UTF-8.
const BOM = String.fromCharCode(0xfeff);

const CSV_HEADER = [
  'Date',
  'Type',
  'Amount (INR)',
  'Category',
  'Wallet',
  'To wallet',
  'Merchant',
  'Note',
  'Tags',
];

export async function exportCsv(userId, { from, to } = {}) {
  const range = await resolveRange(userId, { from, to });
  const rows = await rowsFor(userId, range);
  const lines = [
    CSV_HEADER.join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.type,
        toRupeeString(row.amount), // a number, never a formula
        csvCell(row.category),
        csvCell(row.wallet),
        csvCell(row.toWallet),
        csvCell(row.merchant),
        csvCell(row.note),
        csvCell(row.tags),
      ].join(','),
    ),
  ];
  // The byte-order mark makes Excel read the file as UTF-8 (₹, Hindi, Tamil names…).
  return {
    filename: `paisa-pal-${range.fromDate}-to-${range.toDate}.csv`,
    body: `${BOM}${lines.join('\r\n')}\r\n`,
  };
}

// ---- PDF ------------------------------------------------------------------------------

const EMERALD = '#0f766e';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const MAX_PDF_ROWS = 2000; // beyond this the CSV is the better format

function pdfToBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: 'Paisa Pal report' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}

// A simple table: columns [{ label, width, align }], rows as arrays of strings.
// Starts a new page (repeating the header) when the page is full.
function table(doc, columns, rows) {
  const left = doc.page.margins.left;
  const drawRow = (cells, { bold = false, color = '#111827' } = {}) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      drawRow(
        columns.map((c) => c.label),
        { bold: true, color: MUTED },
      );
    }
    const y = doc.y;
    let x = left;
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(color);
    cells.forEach((cell, i) => {
      doc.text(cell, x, y, {
        width: columns[i].width - 6,
        align: columns[i].align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += columns[i].width;
    });
    doc
      .moveTo(left, y + 14)
      .lineTo(x, y + 14)
      .strokeColor(LINE)
      .lineWidth(0.5)
      .stroke();
    doc.x = left;
    doc.y = y + 18;
  };
  drawRow(
    columns.map((c) => c.label),
    { bold: true, color: MUTED },
  );
  rows.forEach((row) => drawRow(row));
  doc.moveDown(1);
}

function heading(doc, text) {
  doc.moveDown(0.8).font('Helvetica-Bold').fontSize(13).fillColor(EMERALD).text(text);
  doc.moveDown(0.4);
}

export async function exportPdf(userId, { from, to } = {}) {
  const range = await resolveRange(userId, { from, to });
  const [summary, categories, merchants, rows] = await Promise.all([
    reportSummary(userId, { from: range.fromDate, to: range.toDate }),
    spendingByCategory(userId, { from: range.fromDate, to: range.toDate }),
    topMerchants(userId, { from: range.fromDate, to: range.toDate, limit: 10 }),
    rowsFor(userId, range),
  ]);

  const body = await pdfToBuffer((doc) => {
    doc.font('Helvetica-Bold').fontSize(22).fillColor(EMERALD).text('Paisa Pal');
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor(MUTED)
      .text(`Money report · ${range.fromDate} to ${range.toDate}`);

    heading(doc, 'Summary');
    table(
      doc,
      [
        { label: '', width: 200 },
        { label: '', width: 150, align: 'right' },
      ],
      [
        ['Money in', formatRupees(summary.income)],
        ['Money out', formatRupees(summary.expense)],
        [
          'Saved',
          `${formatRupees(summary.saved)}${summary.savingsRate === null ? '' : ` (${summary.savingsRate}%)`}`,
        ],
        ['Average spent per day', formatRupees(summary.avgDailySpend)],
        ['Transactions', String(summary.transactionCount)],
      ],
    );

    if (categories.categories.length) {
      heading(doc, 'Spending by category');
      table(
        doc,
        [
          { label: 'Category', width: 250 },
          { label: 'Amount', width: 150, align: 'right' },
          { label: 'Share', width: 80, align: 'right' },
        ],
        categories.categories.map((c) => [c.name, formatRupees(c.total), `${c.percent}%`]),
      );
    }

    if (merchants.merchants.length) {
      heading(doc, 'Top places');
      table(
        doc,
        [
          { label: 'Where', width: 250 },
          { label: 'Amount', width: 150, align: 'right' },
          { label: 'Times', width: 80, align: 'right' },
        ],
        merchants.merchants.map((m) => [m.name, formatRupees(m.total), String(m.count)]),
      );
    }

    heading(doc, 'All transactions');
    const shown = rows.slice(0, MAX_PDF_ROWS);
    table(
      doc,
      [
        { label: 'Date', width: 70 },
        { label: 'Description', width: 170 },
        { label: 'Category', width: 100 },
        { label: 'Wallet', width: 80 },
        { label: 'Amount', width: 80, align: 'right' },
      ],
      shown.map((row) => [
        row.date,
        row.type === 'transfer' ? `Transfer to ${row.toWallet}` : row.merchant || row.note || '-',
        row.category || '-',
        row.wallet,
        `${row.type === 'income' ? '+' : row.type === 'expense' ? '-' : ''}${formatRupees(row.amount)}`,
      ]),
    );
    if (rows.length > MAX_PDF_ROWS) {
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(MUTED)
        .text(
          `Showing the first ${MAX_PDF_ROWS} of ${rows.length} transactions. Download the CSV for all of them.`,
        );
    }
  });

  return { filename: `paisa-pal-${range.fromDate}-to-${range.toDate}.pdf`, body };
}
