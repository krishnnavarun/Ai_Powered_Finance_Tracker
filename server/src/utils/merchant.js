// Company suffixes and filler words that don't help tell merchants apart.
const NOISE_WORDS = new Set([
  'pvt',
  'ltd',
  'private',
  'limited',
  'llp',
  'inc',
  'co',
  'the',
  'india',
  'www',
  'com',
  'in',
]);

// Turns a merchant name as typed or as printed on a bank statement into a stable key,
// so different spellings of the same shop match:
//   "SWIGGY*Order 8841"        → "swiggy order"
//   "Swiggy"                   → "swiggy"
//   "Reliance Retail Pvt. Ltd" → "reliance retail"
// Used by the categorizer (CP16) and subscription detection (CP18).
export function normalizeMerchant(name) {
  if (!name) return '';
  return (
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '') // strip accents: NFKD split "é" into "e" + a combining mark
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      // Long numbers are order/reference ids ("8841"); short ones can be part of the
      // brand ("7-Eleven"), so only numbers of 3+ digits are dropped.
      .filter((word) => word && !NOISE_WORDS.has(word) && !/^\d{3,}$/.test(word))
      .join(' ')
  );
}
