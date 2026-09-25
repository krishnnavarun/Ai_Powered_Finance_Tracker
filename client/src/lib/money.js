// The API sends and receives money as integer paise. These helpers convert
// at the UI boundary: form input → paise, paise → "₹1,00,000".

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

// Formats paise with Indian digit grouping: 10000000 → "₹1,00,000".
// decimals: 'auto' hides ".00" for whole rupees, 'always' keeps two decimals.
export function formatMoney(paise, { decimals = 'auto' } = {}) {
  const rupees = paise / 100;
  const showDecimals = decimals === 'always' || paise % 100 !== 0;
  return (showDecimals ? inrWithDecimals : inrWhole).format(rupees);
}

// Parses a form value like "1,250.50" into paise. Returns null if invalid.
export function parseRupeesToPaise(value) {
  const cleaned = value.trim().replace(/^₹/, '').replace(/[,\s]/g, '');
  if (!AMOUNT_PATTERN.test(cleaned)) return null;

  const negative = cleaned.startsWith('-');
  const [whole = '0', fraction = ''] = cleaned.replace('-', '').split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));

  if (!Number.isSafeInteger(paise)) return null;
  return negative && paise !== 0 ? -paise : paise;
}

// The opposite, for pre-filling an edit form: 250050 → "2500.50", 250000 → "2500".
export function paiseToInput(paise) {
  if (paise === null || paise === undefined) return '';
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest ? `${sign}${rupees}.${String(rest).padStart(2, '0')}` : `${sign}${rupees}`;
}

const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

// Short amounts for chart axes, in Indian units: ₹950, ₹45K, ₹1.2L, ₹2.5Cr.
export function formatMoneyCompact(paise) {
  return inrCompact.format(paise / 100);
}
