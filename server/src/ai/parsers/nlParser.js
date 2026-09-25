import { z } from 'zod';
import { addDays } from '../../utils/dates.js';
import { toPaise } from '../../utils/money.js';
import { asData, DATA_RULES } from '../prompts/common.js';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const INCOME_WORDS =
  /\b(got|get|received|receive|earned|salary|credited|refund|refunded|cashback|income|won|sold)\b/i;
const TRANSFER_WORDS = /\b(moved|move|transferred|transfer|withdrew|withdraw|deposited)\b/i;

// What the AI must return. Amount in rupees (people write rupees); converted to paise after.
export const nlReplySchema = z.object({
  type: z.enum(['expense', 'income', 'transfer']),
  amount: z.number().positive(),
  merchant: z.string().max(100).nullable(),
  date: z.iso.date().nullable(),
  categoryName: z.string().nullable(),
  walletName: z.string().nullable(),
  toWalletName: z.string().nullable(),
  note: z.string().max(500).nullable(),
  confidence: z.number().min(0).max(1),
});

const weekdayOf = (localDate) => WEEKDAYS[new Date(`${localDate}T00:00:00Z`).getUTCDay()];

export function buildNlPrompt({ text, today, wallets, categories }) {
  const names = (type) =>
    categories
      .filter((c) => c.type === type)
      .map((c) => c.name)
      .join(', ');
  return {
    system: [
      'You turn a short note about money, written by someone in India, into one transaction.',
      DATA_RULES,
      `Today is ${weekdayOf(today)} ${today}. Resolve words like "yesterday" or "last Friday" from today and give dates as YYYY-MM-DD.`,
      'type: "expense" for money spent, "income" for money received, "transfer" for moving money between the user\'s own wallets.',
      'amount: the amount in rupees as a number ("2k" = 2000, "1.5L" = 150000).',
      'merchant: the shop, app or person paid (or who paid), else null. note: a short description, else null.',
      `categoryName: exactly one of these, matching the type, or null. Expense: ${names('expense')}. Income: ${names('income')}.`,
      `walletName / toWalletName: exactly one of these wallet names if mentioned (GPay, PhonePe or Paytm usually means a UPI wallet), else null: ${wallets.map((w) => w.name).join(', ') || '(none)'}.`,
      'confidence: 0 to 1, how sure you are about the whole answer.',
    ].join('\n'),
    user: asData('note', text),
  };
}

// "2k" → 2000, "1.5L" → 150000, "₹2,500" → 2500. Returns paise or null.
function findAmount(text) {
  const match =
    /(?:₹|rs\.?|inr)?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*(k|l|lakh|lac|lakhs|thousand)?\b/i.exec(text);
  if (!match) return null;
  const multiplier = {
    k: 1000,
    thousand: 1000,
    l: 100000,
    lakh: 100000,
    lac: 100000,
    lakhs: 100000,
  }[match[2]?.toLowerCase()];
  try {
    const paise = toPaise(match[1]);
    return multiplier ? Math.round(paise * multiplier) : paise;
  } catch {
    return null;
  }
}

function findDate(text, today) {
  const lower = text.toLowerCase();
  if (/\bday before yesterday\b/.test(lower)) return addDays(today, -2);
  if (/\byesterday\b/.test(lower)) return addDays(today, -1);
  if (/\btoday\b/.test(lower)) return today;
  const weekday = /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/.exec(
    lower,
  );
  if (weekday) {
    const todayIndex = WEEKDAYS.indexOf(weekdayOf(today));
    const back = (todayIndex - WEEKDAYS.indexOf(weekday[1]) + 7) % 7 || 7;
    return addDays(today, -back);
  }
  const daysAgo = /\b(\d{1,2})\s+days?\s+ago\b/.exec(lower);
  if (daysAgo) return addDays(today, -Number(daysAgo[1]));
  return today;
}

const STOP_WORDS = String.raw`(?=\s+(?:from|via|using|by|with|yesterday|today|last|on|for|at|to|in)\b|[,.!]|$)`;

function findPlace(text, type) {
  const patterns =
    type === 'income'
      ? [new RegExp(String.raw`\bfrom\s+([\p{L}][\p{L}\d &'-]{1,40}?)${STOP_WORDS}`, 'iu')]
      : [
          new RegExp(String.raw`\bat\s+([\p{L}][\p{L}\d &'-]{1,40}?)${STOP_WORDS}`, 'iu'),
          new RegExp(String.raw`\bon\s+([\p{L}][\p{L}\d &'-]{1,40}?)${STOP_WORDS}`, 'iu'),
          new RegExp(String.raw`\bfor\s+([\p{L}][\p{L}\d &'-]{1,40}?)${STOP_WORDS}`, 'iu'),
          new RegExp(String.raw`\bto\s+([\p{L}][\p{L}\d &'-]{1,40}?)${STOP_WORDS}`, 'iu'),
        ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    const name = match?.[1]?.trim();
    if (name && !/^(yesterday|today|my|the|a)$/i.test(name)) return name;
  }
  return null;
}

// Finds a wallet the note names: "from GPay", "via HDFC", "using cash".
function findWallet(text, wallets) {
  const lower = ` ${text.toLowerCase()} `;
  const named = wallets.find((w) => lower.includes(` ${w.name.toLowerCase()} `));
  if (named) return named.name;
  if (/\b(gpay|google pay|phonepe|paytm|upi|bhim)\b/.test(lower)) {
    return wallets.find((w) => w.type === 'upi')?.name ?? null;
  }
  if (/\bcash\b/.test(lower)) return wallets.find((w) => w.type === 'cash')?.name ?? null;
  if (/\b(card|credit card)\b/.test(lower))
    return wallets.find((w) => w.type === 'card')?.name ?? null;
  return null;
}

// The no-AI way: good enough for "spent 250 on biryani yesterday from GPay".
// Returns the same shape as the AI reply (amount already in paise), or null when no
// amount can be found.
export function quickParse(text, { today, wallets = [] }) {
  const amount = findAmount(text);
  if (!amount) return null;
  const type = INCOME_WORDS.test(text)
    ? 'income'
    : TRANSFER_WORDS.test(text) && !/\b(spent|paid|bought)\b/i.test(text)
      ? 'transfer'
      : 'expense';
  return {
    type,
    amount,
    merchant: type === 'transfer' ? null : findPlace(text, type),
    date: findDate(text, today),
    categoryName: null,
    walletName: findWallet(text, wallets),
    toWalletName: null,
    note: text.trim().slice(0, 500),
    confidence: 0.5,
  };
}
