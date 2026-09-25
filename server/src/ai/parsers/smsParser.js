import { toPaise } from '../../utils/money.js';

// Reads Indian bank / UPI / card SMS with plain patterns: no AI, instant and free.
// Messages it can't read are returned as 'unknown' and may be sent to the AI instead.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const AMOUNT = String.raw`([\d,]+(?:\.\d{1,2})?)`;
const CURRENCY = String.raw`(?:rs\.?|inr|₹)`;

const SKIP_RULES = [
  { reason: 'otp', pattern: /\b(otp|one[- ]time password|verification code)\b/i },
  {
    reason: 'request',
    pattern: /\b(has requested|requested money|collect request|is requesting)\b/i,
  },
  { reason: 'failed', pattern: /\b(failed|declined|unsuccessful|could not be processed)\b/i },
  { reason: 'future', pattern: /\b(will be debited|will be deducted|is due|due on|due date)\b/i },
];

const PROMO =
  /\b(pre-?approved|apply now|offer|congratulations|you have won|win |get up ?to|limited period|click here|t&c)/i;

const EXPENSE_WORDS = /\b(debited|spent|sent|paid|withdrawn|purchase|debit(?! card))\b/i;
const INCOME_WORDS = /\b(credited|received|deposited|refund(?:ed)?|credit(?! card))\b/i;

const BANKS = [
  ['HDFC', /\bhdfc\b/i],
  ['ICICI', /\bicici\b/i],
  ['SBI', /\b(sbi|state bank)\b/i],
  ['Axis', /\baxis\b/i],
  ['Kotak', /\bkotak\b/i],
  ['Yes Bank', /\byes bank\b/i],
  ['IDFC', /\bidfc\b/i],
  ['IndusInd', /\bindusind\b/i],
  ['PNB', /\b(pnb|punjab national)\b/i],
  ['Bank of Baroda', /\b(bob|bank of baroda)\b/i],
  ['Canara', /\bcanara\b/i],
  ['Union Bank', /\bunion bank\b/i],
  ['Federal', /\bfederal bank\b/i],
  ['Paytm', /\bpaytm\b/i],
];

// Words that follow "to …" / "at …" but aren't a payee.
const NOT_A_NAME = /^(your|you|a\/?c|acct|account|bank|card|vpa|the|upi|mobile|beneficiary)\b/i;

// "1,250.00" → 125000; null for missing or unreadable text.
function safePaise(text) {
  if (!text) return null;
  try {
    return toPaise(text);
  } catch {
    return null;
  }
}

function firstIndex(text, pattern) {
  const match = pattern.exec(text);
  return match ? match.index : Infinity;
}

// "SWIGGY" → "Swiggy", "swiggy.stores" → "Swiggy Stores"; mixed case is left alone.
function tidyName(raw) {
  let name = raw
    .replace(/[._]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:.-]+$/, '')
    .trim();
  if (!/[a-z]/i.test(name) || NOT_A_NAME.test(name) || /\ba\/c\b|\bacct\b/i.test(name)) return null;
  if (name === name.toUpperCase() || name === name.toLowerCase()) {
    name = name.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
  }
  return name.slice(0, 60);
}

// The payment amount: the first rupee amount that isn't a balance or limit.
function findAmount(text) {
  const pattern = new RegExp(`${CURRENCY}\\s*${AMOUNT}`, 'gi');
  for (const match of text.matchAll(pattern)) {
    const before = text.slice(Math.max(0, match.index - 20), match.index).toLowerCase();
    if (/(bal|balance|limit)[^a-z]*$/.test(before)) continue;
    return match[1];
  }
  // SBI style without a currency: "debited by 250.0"
  const bare = new RegExp(`(?:debited|credited)\\s+(?:by|for|with)\\s+${AMOUNT}`, 'i').exec(text);
  return bare?.[1] ?? null;
}

function findBalance(text) {
  const match = new RegExp(
    `(?:avl\\.?\\s*bal(?:ance)?|available balance|bal)[^\\d]{0,15}?${CURRENCY}?\\s*${AMOUNT}`,
    'i',
  ).exec(text);
  return match ? match[1] : null;
}

function twoDigitYear(year) {
  return year.length === 2 ? `20${year}` : year;
}

function validDate(year, month, day) {
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(iso) ? iso : null;
}

// "24-09-26", "24/09/2026", "24-Sep-26", "24Sep26", "30 SEP 2026", "2026-09-24" → "2026-09-24"
export function findDate(text) {
  let match = /\b(20\d\d)-(\d\d)-(\d\d)/.exec(text);
  if (match) return validDate(match[1], match[2], match[3]);

  match = /\b(\d{1,2})[-/ ]?([a-z]{3})[a-z]*[-/ ,]*(\d{2}(?:\d{2})?)\b/i.exec(text);
  if (match && MONTHS.includes(match[2].toLowerCase())) {
    return validDate(twoDigitYear(match[3]), MONTHS.indexOf(match[2].toLowerCase()) + 1, match[1]);
  }

  match = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}(?:\d{2})?)\b/.exec(text);
  if (match) return validDate(twoDigitYear(match[3]), match[2], match[1]);
  return null;
}

function findAccount(text) {
  const match =
    /\b(?:a\/c|acct|account|card)(?:\s*no\.?)?(?:\s*ending(?:\s*with)?)?[\s:]*[x*.]*\s*[x*.]+\s*(\d{3,6})\b/i.exec(
      text,
    ) ?? /\b(?:a\/c|acct|account|card)(?:\s*no\.?)?\s+(\d{4})\b/i.exec(text);
  return match?.[1] ?? null;
}

function findBank(text) {
  return BANKS.find(([, pattern]) => pattern.test(text))?.[0] ?? null;
}

function findReference(text) {
  const match =
    /\b(?:upi\s*ref(?:\s*no)?|ref(?:erence)?\s*(?:no\.?)?|refno|upi)[\s:.#-]*(\d{6,})/i.exec(text);
  return match?.[1] ?? null;
}

const STOP = String.raw`(?=\s+on\b|\s+ref|\s+upi|\s+avl|\s+via|\s+using|\s*[.;\n(]|\s+not you|\s+\d{2}[-/]|$)`;

function findMerchant(text, type) {
  const patterns = [
    // "to VPA swiggy.stores@axisbank" → the name part of the UPI ID
    /\bto\s+(?:vpa\s+)?([a-z][\w.-]{1,40})@[a-z]+/i,
    // ICICI: "…debited for Rs 250; SWIGGY credited."
    /;\s*([a-z][\w &'-]{1,40}?)\s+credited\b/i,
    // card: "at NETFLIX on…", Axis: "…14:22:10 IST AMAZON Avl Limit"
    new RegExp(String.raw`\bat\s+([a-z][\w &'*-]{1,40}?)${STOP}`, 'i'),
    /\bIST\s+([A-Z][\w &'*-]{1,40}?)\s+avl/i,
    // SBI "trf to SWIGGY Refno", HDFC "To SWIGGY\nOn 24/09/26", "to Rahul K on"
    new RegExp(String.raw`\b(?:trf\s+)?to\s+([a-z][\w &'-]{1,40}?)${STOP}`, 'i'),
  ];
  const incomePatterns = [
    new RegExp(String.raw`\b(?:transfer\s+)?from\s+([a-z][\w &'-]{1,40}?)${STOP}`, 'i'),
    new RegExp(String.raw`\bfor\s+([a-z][\w &'-]{2,40}?)${STOP}`, 'i'),
    /\bby\s+([a-z][\w &'-]{2,40}?)(?=\s*[.;]|\s+on\b|\s+ref)/i,
  ];
  for (const pattern of type === 'income' ? [...incomePatterns, ...patterns] : patterns) {
    const match = pattern.exec(text);
    const name = match && tidyName(match[1]);
    if (name && !/^\d+$/.test(name.replace(/\s/g, ''))) return name;
  }
  return null;
}

// Reads one SMS. Returns one of
//   { status: 'parsed', type, amount (paise), merchant, date, account, bank, reference,
//     balance (paise | null), atm }
//   { status: 'skipped', reason: 'otp' | 'request' | 'failed' | 'future' | 'promo' | 'not_transaction' }
//   { status: 'unknown' } — looks like money but the format isn't known
export function parseSms(raw) {
  const text = String(raw ?? '')
    .replace(/\r/g, '')
    .trim();
  if (!text) return { status: 'skipped', reason: 'not_transaction' };

  for (const { reason, pattern } of SKIP_RULES) {
    if (pattern.test(text)) return { status: 'skipped', reason };
  }

  const expenseAt = firstIndex(text, EXPENSE_WORDS);
  const incomeAt = firstIndex(text, INCOME_WORDS);
  const hasVerb = expenseAt !== Infinity || incomeAt !== Infinity;
  if (!hasVerb) {
    if (PROMO.test(text)) return { status: 'skipped', reason: 'promo' };
    return new RegExp(CURRENCY, 'i').test(text)
      ? { status: 'unknown' }
      : { status: 'skipped', reason: 'not_transaction' };
  }
  if (PROMO.test(text) && !/\b(a\/c|acct|account|card)\b/i.test(text)) {
    return { status: 'skipped', reason: 'promo' };
  }

  const amount = safePaise(findAmount(text));
  if (!amount || amount <= 0) return { status: 'unknown' };

  const type = expenseAt <= incomeAt ? 'expense' : 'income';
  const atm = type === 'expense' && /\batm\b|\bcash withdrawal\b/i.test(text);
  const balance = safePaise(findBalance(text));

  return {
    status: 'parsed',
    type,
    amount,
    merchant: atm ? 'ATM withdrawal' : findMerchant(text, type),
    date: findDate(text),
    account: findAccount(text),
    bank: findBank(text),
    reference: findReference(text),
    balance,
    atm,
  };
}

// Splits pasted text into single messages: blank lines separate messages.
export function splitMessages(text, limit = 50) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n-{3,}\n/)
    .map((message) => message.trim())
    .filter(Boolean)
    .slice(0, limit);
}
