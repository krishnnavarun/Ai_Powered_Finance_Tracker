/**
 * The API sends and receives money as integer paise. These helpers convert
 * at the UI boundary: form input → paise, paise → "₹1,00,000".
 */

const AMOUNT_PATTERN = /^-?\d+(\.\d{1,2})?$/;

const inrWithDecimals = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats paise with Indian digit grouping: 10000000 → "₹1,00,000".
 * @param {number} paise
 * @param {{ decimals?: 'auto' | 'always' }} [options] 'auto' hides ".00" for whole rupees.
 * @returns {string}
 */
export function formatMoney(paise, { decimals = 'auto' } = {}) {
  const rupees = paise / 100;
  const showDecimals = decimals === 'always' || paise % 100 !== 0;
  return (showDecimals ? inrWithDecimals : inrWhole).format(rupees);
}

/**
 * Parses a form value like "1,250.50" into paise. Returns null if invalid.
 * @param {string} value
 * @returns {number | null}
 */
export function parseRupeesToPaise(value) {
  const cleaned = value.trim().replace(/^₹/, '').replace(/[,\s]/g, '');
  if (!AMOUNT_PATTERN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [whole = '0', fraction = ''] = cleaned.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(paise)) return null;
  return negative && paise !== 0 ? -paise : paise;
}
