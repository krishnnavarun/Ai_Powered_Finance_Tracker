import { z } from 'zod';
import { categoryByName, suggestCategories } from '../ai/categorizer.js';
import { AIParseError, AIUnavailableError } from '../ai/errors.js';
import { generateJSON } from '../ai/llm/adapter.js';
import { buildNlPrompt, nlReplySchema, quickParse } from '../ai/parsers/nlParser.js';
import {
  buildReceiptPrompt,
  parseReceiptText,
  receiptReplySchema,
} from '../ai/parsers/receiptParser.js';
import { parseSms, splitMessages } from '../ai/parsers/smsParser.js';
import { asData, DATA_RULES } from '../ai/prompts/common.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';
import { Wallet } from '../models/Wallet.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, localDateOf, startOfLocalDay } from '../utils/dates.js';
import { detectImageType } from '../utils/imageType.js';
import { toPaise } from '../utils/money.js';
import { aiStatus, assertAIAllowed } from './ai.service.js';
import { getUserPrefs } from './userPrefs.js';

// Turns typed notes and bank SMS into *draft* transactions. Nothing is saved here: the
// user reviews each draft and saves it through the normal POST /transactions.

async function captureContext(userId) {
  const [{ timeZone }, wallets, categories, status] = await Promise.all([
    getUserPrefs(userId),
    Wallet.find({ userId, isArchived: false }).sort({ createdAt: 1 }).lean(),
    Category.find({ userId, isArchived: false }).lean(),
    aiStatus(userId),
  ]);
  return {
    timeZone,
    today: localDateOf(new Date(), timeZone),
    wallets,
    categories,
    aiAllowed: status.enabled && status.configured,
  };
}

// AI failures are not errors for the user: we quietly use the plain way instead.
async function tryAI(run) {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AIUnavailableError || error instanceof AIParseError) return null;
    throw error;
  }
}

function walletByName(wallets, name) {
  if (!name) return null;
  const wanted = name.trim().toLowerCase();
  return wallets.find((w) => w.name.toLowerCase() === wanted) ?? null;
}

// Dates from the AI or an SMS must be real and not in the future; else today.
function safeDate(date, today) {
  return date && date <= addDays(today, 1) && date >= '2000-01-01' ? date : today;
}

function rupeesToPaise(amount) {
  try {
    const paise = toPaise(String(amount));
    return paise > 0 ? paise : null;
  } catch {
    return null;
  }
}

const idOf = (doc) => (doc ? String(doc._id) : null);

// ---- Typed notes ("spent 250 on biryani yesterday from GPay")

export async function parseText(userId, text) {
  const ctx = await captureContext(userId);

  let reply = null;
  if (ctx.aiAllowed) {
    const answer = await tryAI(() =>
      generateJSON({
        ...buildNlPrompt({ text, ...ctx }),
        schema: nlReplySchema,
        userId,
        purpose: 'parse-text',
      }),
    );
    const amount = answer && rupeesToPaise(answer.amount);
    if (amount) reply = { ...answer, amount };
  }
  const usedAI = Boolean(reply);
  reply ??= quickParse(text, ctx);
  if (!reply) {
    throw new ApiError(
      422,
      'NOTHING_FOUND',
      'Could not find an amount. Try something like "spent 250 on lunch".',
    );
  }

  const { type } = reply;
  let category =
    type === 'transfer' ? null : categoryByName(ctx.categories, type, reply.categoryName);
  let confidence = reply.confidence;
  if (!category && type !== 'transfer') {
    const [suggestion] = await suggestCategories(userId, [
      { type, merchant: reply.merchant, note: reply.note },
    ]);
    category = ctx.categories.find((c) => String(c._id) === suggestion.categoryId) ?? null;
  }
  const wallet = walletByName(ctx.wallets, reply.walletName);
  const toWallet = type === 'transfer' ? walletByName(ctx.wallets, reply.toWalletName) : null;
  if (!wallet || !category) confidence = Math.min(confidence, 0.6);

  return {
    usedAI,
    draft: {
      type,
      amount: reply.amount,
      walletId: idOf(wallet),
      toWalletId: idOf(toWallet),
      categoryId: idOf(category),
      merchant: reply.merchant ?? '',
      note: reply.note ?? '',
      date: safeDate(reply.date, ctx.today),
      source: 'nl',
      aiConfidence: Math.round(confidence * 100) / 100,
    },
  };
}

// ---- Bank SMS

const smsReplySchema = z.object({
  results: z.array(
    z.object({
      index: z.int().min(0),
      isTransaction: z.boolean(),
      type: z.enum(['expense', 'income']).nullable(),
      amount: z.number().positive().nullable(),
      merchant: z.string().max(100).nullable(),
      date: z.iso.date().nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

// Formats the regex doesn't know go to the AI, all in one call.
async function readUnknownWithAI(userId, today, unknown) {
  const lines = unknown.map(({ index, text }) => `#${index}\n${text}`).join('\n\n');
  const reply = await tryAI(() =>
    generateJSON({
      userId,
      purpose: 'parse-sms',
      schema: smsReplySchema,
      system: [
        'You read bank, UPI and card SMS from India. Each message starts with #<index>.',
        DATA_RULES,
        `Today is ${today}. Dates as YYYY-MM-DD.`,
        'isTransaction: true only if money actually left or entered an account (not OTPs, offers, reminders, failed payments or requests).',
        'type: "expense" for money out, "income" for money in. amount in rupees. merchant: who was paid or who paid, else null.',
      ].join('\n'),
      user: `Return { "results": [...] } with one entry per message:\n${asData('sms', lines)}`,
    }),
  );
  return new Map((reply?.results ?? []).map((result) => [result.index, result]));
}

// A wallet whose name mentions the account's last digits or the bank ("HDFC 1234").
function matchWallet(wallets, { account, bank }) {
  if (account) {
    const byDigits = wallets.find((w) => w.name.includes(account));
    if (byDigits) return byDigits;
  }
  if (bank) {
    const byBank = wallets.find((w) => w.name.toLowerCase().includes(bank.toLowerCase()));
    if (byBank) return byBank;
  }
  return null;
}

// Existing transactions with the same type and amount within a day either side.
async function findDuplicates(userId, drafts, timeZone) {
  if (!drafts.length) return new Set();
  const dates = drafts.map((d) => d.date).sort();
  const existing = await Transaction.find({
    userId,
    amount: { $in: [...new Set(drafts.map((d) => d.amount))] },
    date: {
      $gte: startOfLocalDay(addDays(dates[0], -1), timeZone),
      $lt: startOfLocalDay(addDays(dates.at(-1), 2), timeZone),
    },
  })
    .select('type amount date')
    .lean();

  const duplicates = new Set();
  drafts.forEach((draft, i) => {
    const near = [addDays(draft.date, -1), draft.date, addDays(draft.date, 1)];
    if (
      existing.some(
        (t) =>
          t.amount === draft.amount &&
          (t.type === draft.type || (draft.type === 'transfer' && t.type === 'expense')) &&
          near.includes(localDateOf(t.date, timeZone)),
      )
    ) {
      duplicates.add(i);
    }
  });
  return duplicates;
}

export async function parseSmsBatch(userId, text) {
  const ctx = await captureContext(userId);
  const messages = splitMessages(text);
  const results = messages.map((message) => parseSms(message));

  const unknown = results
    .map((result, index) => ({ result, index, text: messages[index] }))
    .filter(({ result }) => result.status === 'unknown');
  const aiAnswers =
    ctx.aiAllowed && unknown.length
      ? await readUnknownWithAI(userId, ctx.today, unknown)
      : new Map();

  const cashWallet = ctx.wallets.find((w) => w.type === 'cash');
  const items = messages.map((message, index) => {
    const result = results[index];
    if (result.status === 'skipped')
      return { index, text: message, status: 'skipped', reason: result.reason };

    let parsed = result;
    let via = 'regex';
    if (result.status === 'unknown') {
      const answer = aiAnswers.get(index);
      const amount = answer?.isTransaction && answer.type && rupeesToPaise(answer.amount);
      if (!amount) {
        return {
          index,
          text: message,
          status: 'skipped',
          reason: ctx.aiAllowed ? 'not_transaction' : 'unknown_format',
        };
      }
      parsed = { ...answer, amount, account: null, bank: null, reference: null, atm: false };
      via = 'ai';
    }

    const wallet = matchWallet(ctx.wallets, parsed);
    // Taking cash out of an ATM moves money into the cash wallet; it isn't spending.
    const toCash = parsed.atm && cashWallet && idOf(cashWallet) !== idOf(wallet);
    const confidence = via === 'ai' ? (parsed.confidence ?? 0.6) : parsed.merchant ? 0.9 : 0.75;
    return {
      index,
      text: message,
      status: 'ready',
      via,
      draft: {
        type: toCash ? 'transfer' : parsed.type,
        amount: parsed.amount,
        walletId: idOf(wallet),
        toWalletId: toCash ? idOf(cashWallet) : null,
        categoryId: null,
        merchant: toCash ? '' : (parsed.merchant ?? ''),
        note: [toCash ? 'ATM withdrawal' : '', parsed.reference ? `Ref ${parsed.reference}` : '']
          .filter(Boolean)
          .join(' · '),
        date: safeDate(parsed.date, ctx.today),
        source: 'sms',
        aiConfidence: Math.round(Math.min(confidence, wallet ? 1 : 0.7) * 100) / 100,
      },
    };
  });

  const ready = items.filter((item) => item.status === 'ready');
  const suggestions = await suggestCategories(
    userId,
    ready.map(({ draft }) => ({ type: draft.type, merchant: draft.merchant, note: draft.note })),
    { useAI: ctx.aiAllowed },
  );
  ready.forEach((item, i) => {
    item.draft.categoryId = suggestions[i].categoryId;
  });

  // The same payment pasted twice, or already in the app.
  const duplicates = await findDuplicates(
    userId,
    ready.map((item) => item.draft),
    ctx.timeZone,
  );
  const seen = new Set();
  ready.forEach((item, i) => {
    const { type, amount, date, note, merchant } = item.draft;
    const key = `${type}|${amount}|${date}|${note || merchant}`;
    item.possibleDuplicate = duplicates.has(i) || seen.has(key);
    seen.add(key);
  });

  return {
    items,
    usedAI: ctx.aiAllowed && (aiAnswers.size > 0 || suggestions.some((s) => s.via === 'ai')),
  };
}

// ---- Receipts

// The category the AI named, else the categorizer's guess from the merchant.
async function receiptCategory(userId, ctx, { categoryName, merchant, note }) {
  const named = categoryByName(ctx.categories, 'expense', categoryName);
  if (named) return named;
  const [suggestion] = await suggestCategories(userId, [{ type: 'expense', merchant, note }]);
  return ctx.categories.find((c) => String(c._id) === suggestion.categoryId) ?? null;
}

// "Milk, Bread, Rice 5kg and 2 more"
function itemsSummary(items) {
  const names = items.map((item) => item.name.trim()).filter(Boolean);
  if (!names.length) return '';
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} and ${names.length - 3} more` : shown;
}

// A receipt photo read by the AI (vision). Needs AI; the client reads the photo on the
// device instead (parseReceiptOcrText) when AI is off.
export async function parseReceiptImage(userId, file) {
  if (!file) throw ApiError.badRequest('Choose a photo of the receipt');
  const image = detectImageType(file.buffer);
  if (!image) throw new ApiError(400, 'UNSUPPORTED_FILE', 'Please upload a JPG, PNG or WebP photo');
  await assertAIAllowed(userId);

  const ctx = await captureContext(userId);
  const reply = await generateJSON({
    ...buildReceiptPrompt(ctx),
    image: { mimeType: image.type, base64: file.buffer.toString('base64') },
    schema: receiptReplySchema,
    userId,
    purpose: 'parse-receipt',
  });
  const amount = reply.isReceipt && reply.total ? rupeesToPaise(reply.total) : null;
  if (!amount) {
    throw new ApiError(
      422,
      'NOT_A_RECEIPT',
      'This doesn’t look like a receipt. Try a clearer photo.',
    );
  }

  const note = itemsSummary(reply.items);
  const category = await receiptCategory(userId, ctx, { ...reply, note });
  return {
    usedAI: true,
    items: reply.items,
    tax: reply.tax === null ? null : rupeesToPaise(reply.tax),
    draft: {
      type: 'expense',
      amount,
      walletId: null,
      toWalletId: null,
      categoryId: idOf(category),
      merchant: reply.merchant ?? '',
      note,
      date: safeDate(reply.date, ctx.today),
      source: 'receipt',
      aiConfidence: Math.round(Math.min(reply.confidence, category ? 1 : 0.6) * 100) / 100,
    },
  };
}

// Text the device read from a receipt photo (OCR), when AI is off. No AI involved.
export async function parseReceiptOcrText(userId, text) {
  const ctx = await captureContext(userId);
  const found = parseReceiptText(text);
  if (!found.total) {
    throw new ApiError(
      422,
      'NOTHING_FOUND',
      'Could not find the total on this receipt. Type the amount in the form instead.',
    );
  }
  const category = await receiptCategory(userId, ctx, { merchant: found.merchant });
  return {
    usedAI: false,
    items: [],
    tax: null,
    draft: {
      type: 'expense',
      amount: found.total,
      walletId: null,
      toWalletId: null,
      categoryId: idOf(category),
      merchant: found.merchant ?? '',
      note: '',
      date: safeDate(found.date, ctx.today),
      source: 'receipt',
      aiConfidence: 0.5,
    },
  };
}

// ---- Categories for a list of payments (CSV import, "suggest categories")

export async function categorize(userId, items) {
  const { enabled, configured } = await aiStatus(userId);
  const suggestions = await suggestCategories(userId, items, { useAI: enabled && configured });
  return { suggestions };
}
