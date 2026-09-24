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
