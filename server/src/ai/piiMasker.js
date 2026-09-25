// Hides personal details before any text is sent to an AI provider. The AI only needs
// amounts, dates and shop names; it never needs someone's card, phone or Aadhaar number.
//
// Each rule replaces a match and counts it, so callers can log *how many* things were
// hidden without logging the things themselves. Order matters: emails before UPI IDs
// (both have "@"), grouped numbers before loose digit runs.

const keepLast4 = (digits) => `XXXX${digits.slice(-4)}`;
const onlyDigits = (text) => text.replace(/\D/g, '');

const RULES = [
  {
    // asha.rao@gmail.com → [email]
    kind: 'email',
    pattern: /\b[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi,
    replace: () => '[email]',
  },
  {
    // rahul.k@okhdfcbank → XXXX@okhdfcbank (the bank handle helps; the name doesn't)
    kind: 'upi',
    pattern: /\b[\w.-]{2,}@([a-z]{2,})\b/gi,
    replace: (_match, handle) => `XXXX@${handle}`,
  },
  {
    // ABCDE1234F
    kind: 'pan',
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replace: () => '[PAN]',
  },
  {
    // One-time passwords: "OTP is 482913", "code: 4821", "OTP 123456 for…"
    kind: 'otp',
    pattern:
      /\b(otp|one[- ]time password|verification code|code|pin)(\s*(?:is|:|-)?\s*)(\d{4,8})\b/gi,
    replace: (_match, word, gap) => `${word}${gap}XXXXXX`,
  },
  {
    // Card numbers written in groups: 4111 1111 1111 1234 / 4111-1111-1111-1234
    kind: 'card',
    pattern: /\b\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7}\b/g,
    replace: (match) => keepLast4(onlyDigits(match)),
  },
  {
    // Aadhaar in groups: 1234 5678 9012
    kind: 'aadhaar',
    pattern: /\b\d{4} \d{4} \d{4}\b/g,
    replace: (match) => `XXXX XXXX ${match.slice(-4)}`,
  },
  {
    // Indian mobile numbers: +91 98765 43210, 09876543210, 9876543210
    kind: 'phone',
    pattern: /(?<![\w.])(?:\+91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}\b/g,
    replace: (match) => keepLast4(onlyDigits(match)),
  },
  {
    // Account numbers, card numbers without spaces, Aadhaar without spaces: 9–19 digits.
    // Amounts are safe: they are shorter, or written with commas / decimals.
    kind: 'account',
    pattern: /(?<![\d.,])\d{9,19}(?![\d.,]\d)/g,
    replace: (match) => keepLast4(match),
  },
];

// maskPII("Paid to rahul@okicici from A/c 123456789012")
//   → { text: "Paid to XXXX@okicici from A/c XXXX9012", counts: { upi: 1, account: 1 } }
export function maskPII(input) {
  if (!input) return { text: input ?? '', counts: {} };
  const counts = {};
  let text = String(input);
  for (const { kind, pattern, replace } of RULES) {
    text = text.replace(pattern, (...args) => {
      counts[kind] = (counts[kind] ?? 0) + 1;
      return replace(...args);
    });
  }
  return { text, counts };
}
