// Money is always stored as integer paise (₹250.50 → 25050).
// Parse at the edges (user input, SMS, CSV) and format only in the UI.

const AMOUNT_PATTERN = /^-?\d+(\.\d+)?$/;

// Parses a rupee amount ("250.50", "₹1,00,000", "Rs. 99", 12.5) into integer paise.
// Throws if the input is not a valid amount.
export function toPaise(input) {
  const raw = typeof input === 'number' ? String(input) : input;
  const cleaned = raw
    .trim()
    .replace(/^(rs\.?|inr|₹)/i, '')
    .replace(/[,\s]/g, '');

  if (!AMOUNT_PATTERN.test(cleaned)) {
    throw new Error(`Invalid amount: ${String(input)}`);
  }

  const negative = cleaned.startsWith('-');
  const [whole = '0', fraction = ''] = cleaned.replace('-', '').split('.');
  // Round half-up on the third decimal digit, e.g. "1.005" → 101 paise.
  const fractionPaise = Math.round(Number(fraction.padEnd(3, '0').slice(0, 3)) / 10);
  const paise = Number(whole) * 100 + fractionPaise;

  if (!Number.isSafeInteger(paise)) {
    throw new Error(`Amount out of range: ${String(input)}`);
  }
  return negative && paise !== 0 ? -paise : paise;
}

// Converts paise back to rupees. For display/export only — never store the result.
export function fromPaise(paise) {
  return paise / 100;
}

// True if the value is a whole number of paise that fits safely in a JS number.
export function isValidPaise(value) {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

const indianGrouping = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// For PDFs and plain text: 10000050 → "Rs. 1,00,000.50". (The PDF's built-in fonts have
// no ₹ glyph, and "Rs." is the usual written form in Indian documents.)
export function formatRupees(paise) {
  const sign = paise < 0 ? '-' : '';
  return `${sign}Rs. ${indianGrouping.format(Math.abs(paise) / 100)}`;
}

// For CSV: plain rupees with two decimals and no grouping, so spreadsheets can add them up.
export function toRupeeString(paise) {
  return (paise / 100).toFixed(2);
}

// For messages shown in the app: 10000050 → "₹1,00,000.50", 250000 → "₹2,500" (no ".00").
export function formatINR(paise) {
  const sign = paise < 0 ? '-' : '';
  const whole = Math.abs(paise) % 100 === 0;
  const text = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(paise) / 100);
  return `${sign}₹${text}`;
}
