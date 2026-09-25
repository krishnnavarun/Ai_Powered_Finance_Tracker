import { parse } from 'csv-parse/sync';
import { toPaise } from '../../utils/money.js';

// Reads bank statements exported as CSV. Banks differ a lot: a few lines of account
// details before the header, "Withdrawal"/"Deposit" or "Debit"/"Credit" or one signed
// "Amount" column, day-first or month-first dates, "Cr"/"Dr" after amounts…

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Header words → the column they name. Checked in this order, first match wins.
const HEADER_WORDS = {
  date: /^(txn|transaction|value|posting|tran)?\s*\.?\s*date|^date/i,
  description: /narration|description|particulars|details|remarks|transaction\s*details|merchant/i,
  // Before debit/credit, so "Dr/Cr" isn't taken for a debit column.
  drcr: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|debit\s*\/\s*credit|txn\s*type)$/i,
  debit: /debit|withdrawal|withdrawl|dr\b|money\s*out|paid\s*out/i,
  credit: /credit|deposit|cr\b|money\s*in|paid\s*in/i,
  amount: /^(txn|transaction)?\s*amount|^amt/i,
  reference: /ref|chq|cheque|utr/i,
  balance: /balance|bal\b/i,
};
export const COLUMNS = Object.keys(HEADER_WORDS);

export const MAX_ROWS = 5000;

// Reads the file into rows of trimmed cells. Tolerates a byte-order mark, uneven rows
// and stray quotes.
export function readCsv(buffer) {
  return parse(buffer, {
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
    trim: true,
    to: MAX_ROWS + 50,
  });
}

// Guesses what each header cell means. → { date: 0, description: 1, … } (null = none).
export function mappingFromHeader(header) {
  const mapping = Object.fromEntries(COLUMNS.map((column) => [column, null]));
  const used = new Set();
  for (const column of COLUMNS) {
    const index = header.findIndex((cell, i) => !used.has(i) && HEADER_WORDS[column].test(cell));
    if (index !== -1) {
      mapping[column] = index;
      used.add(index);
    }
  }
  return mapping;
}

// A mapping is usable if it has a date and some way to read the amount.
export function isUsable(mapping) {
  return (
    mapping.date !== null &&
    (mapping.amount !== null || mapping.debit !== null || mapping.credit !== null)
  );
}

// The header is the first line (within the first 30) that names a date column and an
// amount column; bank exports often start with account details.
export function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i += 1) {
    const mapping = mappingFromHeader(rows[i]);
    if (isUsable(mapping)) return { headerIndex: i, mapping };
  }
  return { headerIndex: -1, mapping: null };
}

// ---- Dates ----------------------------------------------------------------------

function validDate(year, month, day) {
  const y = String(year).length === 2 ? `20${year}` : String(year);
  const iso = `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

// Numeric day/month dates: "24/09/2026" (Indian, day first) or "09/24/2026" (US).
const NUMERIC = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/;

// Whether the file writes the day first. India does; a file with any "month" above 12
// in the second place must be month-first (US style).
export function detectDayFirst(values) {
  for (const value of values) {
    const match = NUMERIC.exec(value ?? '');
    if (match && Number(match[2]) > 12) return false;
    if (match && Number(match[1]) > 12) return true;
  }
  return true;
}

// "24/09/2026", "24-09-26", "24.09.2026 10:22", "24-Sep-2026", "24 Sep 26",
// "2026-09-24", "Sep 24, 2026" → "2026-09-24" (or null).
export function parseStatementDate(value, { dayFirst = true } = {}) {
  const text = String(value ?? '').trim();
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(text);
  if (match) return validDate(match[1], match[2], match[3]);

  match = NUMERIC.exec(text);
  if (match) {
    const [day, month] = dayFirst ? [match[1], match[2]] : [match[2], match[1]];
    return validDate(match[3], month, day);
  }

  match = /^(\d{1,2})[-/ ]([a-z]{3})[a-z]*[-/ ,]+(\d{2}|\d{4})\b/i.exec(text);
  if (match && MONTHS.includes(match[2].toLowerCase())) {
    return validDate(match[3], MONTHS.indexOf(match[2].toLowerCase()) + 1, match[1]);
  }

  match = /^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(text);
  if (match && MONTHS.includes(match[1].toLowerCase())) {
    return validDate(match[3], MONTHS.indexOf(match[1].toLowerCase()) + 1, match[2]);
  }
  return null;
}

// ---- Amounts --------------------------------------------------------------------

// "1,234.56" → { paise: 123456, sign: 1 }; "(1,234.56)", "-1234.56" or "1,234.56 Dr"
// → sign -1; "1,234.56 Cr" → sign +1. Empty or "0.00" → null.
export function parseStatementAmount(value) {
  let text = String(value ?? '').trim();
  if (!text || text === '-') return null;
  let sign = 1;
  if (/\bdr\.?$/i.test(text)) sign = -1;
  text = text.replace(/\s*(cr|dr)\.?$/i, '');
  if (/^\(.*\)$/.test(text)) {
    sign = -1;
    text = text.slice(1, -1);
  }
  if (text.startsWith('-')) {
    sign = -1;
    text = text.slice(1);
  }
  text = text.replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/[,\s]/g, '');
  try {
    const paise = toPaise(text);
    return paise === 0 ? null : { paise: Math.abs(paise), sign: paise < 0 ? -sign : sign };
  } catch {
    return null;
  }
}

// ---- Merchant from a bank narration ---------------------------------------------

// Parts of a narration that are never the merchant.
const NOISE =
  /^(upi|dr|cr|neft|imps|rtgs|pos|atm|ach|nach|ecs|mmt|inb|ib|bil|onl|txn|ref|payment|paid|to|from|by|transfer|trf|p2m|p2a|debit|credit|card|purchase|mb|imps\s*p2a)$/i;
const BANK_CODE =
  /^[A-Z]{4}0[A-Z0-9]{6}$|^(yesb|hdfc|icic|sbin|utib|kkbk|punb|barb|cnrb|idib|ubin|ioba|indb|fdrl|kvbl|ratn|paytm|ybl|okaxis|okhdfcbank|okicici|oksbi|axl|ibl)$/i;

function titleCase(text) {
  return text === text.toUpperCase() || text === text.toLowerCase()
    ? text.toLowerCase().replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase())
    : text;
}

// "UPI/DR/426712345678/SWIGGY/YESB/swiggy@ybl/Payment" → "Swiggy"
// "POS 4455 DMART PURCHASE" → "Dmart"; "NEFT CR-HDFC0000001-ACME CORP-SALARY" → "Acme Corp"
export function merchantFromNarration(description) {
  const text = String(description ?? '').trim();
  if (!text) return '';
  const parts = text
    .split(/[/|:*]|\s-\s|-(?=[A-Z])|(?<=[A-Z0-9])-/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const words = part
      .split(/\s+/)
      .filter((word) => !NOISE.test(word) && !/^\d+$/.test(word) && !BANK_CODE.test(word));
    const candidate = words.join(' ');
    if (candidate.includes('@')) continue; // a UPI id
    if ((candidate.match(/[a-z]/gi) ?? []).length >= 3) return titleCase(candidate).slice(0, 60);
  }
  return titleCase(text).slice(0, 60);
}

// ---- Rows -----------------------------------------------------------------------

const DRCR_DEBIT = /^(dr|d|debit|withdrawal)\.?$/i;
const DRCR_CREDIT = /^(cr|c|credit|deposit)\.?$/i;

// Reads the statement rows under the header with the given mapping.
// → { rows: [{ index, date, description, merchant, amount, type, reference }], skipped }
// `skipped` counts lines without a readable date or amount (totals, footers…).
export function readStatementRows(rows, { headerIndex, mapping }) {
  const body = rows.slice(headerIndex + 1);
  const cell = (row, column) => (mapping[column] === null ? '' : (row[mapping[column]] ?? ''));
  const dayFirst = detectDayFirst(body.map((row) => cell(row, 'date')));

  const result = [];
  let skipped = 0;
  body.forEach((row, i) => {
    const date = parseStatementDate(cell(row, 'date'), { dayFirst });
    let amount = null;
    let type = null;
    const debit = parseStatementAmount(cell(row, 'debit'));
    const credit = parseStatementAmount(cell(row, 'credit'));
    if (debit) {
      amount = debit.paise;
      type = 'expense';
    } else if (credit) {
      amount = credit.paise;
      type = 'income';
    } else {
      const signed = parseStatementAmount(cell(row, 'amount'));
      if (signed) {
        amount = signed.paise;
        const drcr = cell(row, 'drcr');
        if (DRCR_DEBIT.test(drcr)) type = 'expense';
        else if (DRCR_CREDIT.test(drcr)) type = 'income';
        else type = signed.sign < 0 ? 'expense' : 'income';
      }
    }
    if (!date || !amount) {
      skipped += 1;
      return;
    }
    const description = cell(row, 'description').replace(/\s+/g, ' ').slice(0, 500);
    result.push({
      index: result.length,
      line: headerIndex + i + 2, // 1-based line in the file, for "line 14 looks odd"
      date,
      description,
      merchant: merchantFromNarration(description),
      amount,
      type,
      reference: cell(row, 'reference').slice(0, 60),
    });
  });
  return { rows: result.slice(0, MAX_ROWS), skipped, dayFirst };
}
