import { describe, expect, it } from 'vitest';
import {
  detectDayFirst,
  findHeader,
  merchantFromNarration,
  parseStatementAmount,
  parseStatementDate,
  readCsv,
  readStatementRows,
} from '../../src/ai/parsers/csvImporter.js';
import {
  DRCR_CSV,
  HDFC_CSV,
  NO_HEADER_CSV,
  SIGNED_CSV,
  US_DATES_CSV,
} from '../fixtures/statements.js';

const read = (csv) => {
  const rows = readCsv(Buffer.from(csv));
  return readStatementRows(rows, findHeader(rows));
};

describe('findHeader', () => {
  it('skips account details and maps the columns by name', () => {
    expect(findHeader(readCsv(Buffer.from(HDFC_CSV)))).toEqual({
      headerIndex: 4,
      mapping: {
        date: 0,
        description: 1,
        debit: 4,
        credit: 5,
        amount: null,
        drcr: null,
        reference: 2,
        balance: 6,
      },
    });
  });

  it('finds a single Amount column and a Dr/Cr column', () => {
    expect(findHeader(readCsv(Buffer.from(DRCR_CSV))).mapping).toMatchObject({
      date: 0,
      description: 1,
      amount: 2,
      drcr: 3,
      debit: null,
      credit: null,
    });
  });

  it('reports when there is no usable header', () => {
    expect(findHeader(readCsv(Buffer.from(NO_HEADER_CSV)))).toEqual({
      headerIndex: -1,
      mapping: null,
    });
  });
});

describe('readStatementRows', () => {
  it('reads an HDFC export, skipping blank and balance lines', () => {
    const { rows, skipped } = read(HDFC_CSV);
    expect(skipped).toBe(2);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({
      date: '2026-09-01',
      type: 'income',
      amount: 6000000,
      merchant: 'Acme Corp',
      reference: '0000426712345601',
      line: 6,
    });
    expect(rows.slice(1).map((r) => [r.merchant, r.type, r.amount])).toEqual([
      ['Swiggy', 'expense', 25000],
      ['Dmart', 'expense', 184550],
      ['Rahul K', 'expense', 60000],
      ['Bajaj Finance Ltd', 'expense', 450000],
    ]);
  });

  it('reads a signed amount column with a byte-order mark', () => {
    const { rows } = read(SIGNED_CSV);
    expect(rows.map((r) => [r.date, r.type, r.amount, r.merchant])).toEqual([
      ['2026-09-03', 'expense', 64900, 'Netflix.com'],
      ['2026-09-04', 'income', 1240, 'Interest'],
      ['2026-09-07', 'expense', 18000, 'Uber India Systems'],
    ]);
  });

  it('uses the Dr/Cr column for the direction', () => {
    const { rows } = read(DRCR_CSV);
    expect(rows.map((r) => [r.date, r.type, r.amount, r.description])).toEqual([
      ['2026-09-24', 'expense', 34900, 'ZOMATO, BANGALORE'],
      ['2026-09-25', 'income', 29900, 'REFUND AMAZON'],
    ]);
  });

  it('notices month-first (US) dates', () => {
    const { rows, dayFirst } = read(US_DATES_CSV);
    expect(dayFirst).toBe(false);
    expect(rows.map((r) => r.date)).toEqual(['2026-09-03', '2026-09-24']);
  });
});

describe('parseStatementDate', () => {
  it.each([
    ['24/09/2026', '2026-09-24'],
    ['24-09-26', '2026-09-24'],
    ['24.09.2026 10:22:11', '2026-09-24'],
    ['24-Sep-2026', '2026-09-24'],
    ['24 Sep 26', '2026-09-24'],
    ['2026-09-24', '2026-09-24'],
    ['Sep 24, 2026', '2026-09-24'],
    ['31/02/2026', null],
    ['Opening balance', null],
  ])('%j → %j', (value, expected) => expect(parseStatementDate(value)).toBe(expected));

  it('reads month-first when told to', () => {
    expect(parseStatementDate('09/03/2026', { dayFirst: false })).toBe('2026-09-03');
  });
});

describe('detectDayFirst', () => {
  it('is day-first unless a second number is above 12', () => {
    expect(detectDayFirst(['01/02/2026', '03/04/2026'])).toBe(true);
    expect(detectDayFirst(['24/09/2026'])).toBe(true);
    expect(detectDayFirst(['09/24/2026'])).toBe(false);
  });
});

describe('parseStatementAmount', () => {
  it.each([
    ['1,234.56', { paise: 123456, sign: 1 }],
    ['-1234.56', { paise: 123456, sign: -1 }],
    ['(1,234.56)', { paise: 123456, sign: -1 }],
    ['1,234.56 Dr', { paise: 123456, sign: -1 }],
    ['1,234.56 Cr', { paise: 123456, sign: 1 }],
    ['₹ 1,00,000', { paise: 10000000, sign: 1 }],
    ['0.00', null],
    ['', null],
    ['abc', null],
  ])('%j', (value, expected) => expect(parseStatementAmount(value)).toEqual(expected));
});

describe('merchantFromNarration', () => {
  it.each([
    ['UPI/DR/426712345678/SWIGGY/YESB/swiggy@ybl/Payment', 'Swiggy'],
    ['POS 4455 DMART PURCHASE', 'Dmart'],
    ['NEFT CR-HDFC0000001-ACME CORP-SALARY', 'Acme Corp'],
    ['IMPS-426712345678-Rahul Kumar-SBIN0001234', 'Rahul Kumar'],
    ['NETFLIX.COM', 'Netflix.com'],
    ['', ''],
  ])('%j → %j', (value, expected) => expect(merchantFromNarration(value)).toBe(expected));
});
