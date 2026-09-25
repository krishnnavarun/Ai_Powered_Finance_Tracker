import { z } from 'zod';
import { suggestCategories } from '../ai/categorizer.js';
import { AIParseError, AIUnavailableError } from '../ai/errors.js';
import { generateJSON } from '../ai/llm/adapter.js';
import {
  COLUMNS,
  findHeader,
  isUsable,
  readCsv,
  readStatementRows,
} from '../ai/parsers/csvImporter.js';
import { asData, DATA_RULES } from '../ai/prompts/common.js';
import { Transaction } from '../models/Transaction.js';
import { ApiError } from '../utils/ApiError.js';
import { addDays, localDateOf, startOfLocalDay } from '../utils/dates.js';
import { normalizeMerchant } from '../utils/merchant.js';
import { aiStatus } from './ai.service.js';
import { importTransactions } from './transaction.service.js';
import { getUserPrefs } from './userPrefs.js';

// At most this many different merchants are sent to the AI per file (4 calls of 50).
const AI_MERCHANT_LIMIT = 200;

function badFile(message) {
  return new ApiError(400, 'UNSUPPORTED_FILE', message);
}

function readRows(file) {
  if (!file) throw ApiError.badRequest('Choose a CSV file');
  // Excel (.xlsx) files are zip archives ("PK…"); other binaries contain NUL bytes.
  if (file.buffer.subarray(0, 2).toString() === 'PK' || file.buffer.includes(0)) {
    throw badFile('Please upload a CSV file. In Excel: File → Save As → CSV.');
  }
  try {
    return readCsv(file.buffer);
  } catch {
    throw badFile('This file could not be read as CSV.');
  }
}

const aiMappingSchema = z.object({
  headerIndex: z.int().min(0),
  ...Object.fromEntries(COLUMNS.map((column) => [column, z.int().min(0).nullable()])),
});

// When the header names mean nothing to us, the AI looks at the first lines.
async function mappingFromAI(userId, rows) {
  const preview = rows
    .slice(0, 15)
    .map((row, i) => `${i}: ${row.join(' | ')}`)
    .join('\n');
  try {
    const answer = await generateJSON({
      userId,
      purpose: 'csv-columns',
      schema: aiMappingSchema,
      system: [
        'You look at the first lines of a bank statement exported as CSV.',
        DATA_RULES,
        'Find the header line (headerIndex, counting from 0) and the column number (from 0) of each field, or null:',
        'date, description (narration), debit (money out), credit (money in), amount (one signed column), drcr (a Dr/Cr column), reference, balance.',
      ].join('\n'),
      user: asData('csv', preview),
    });
    const { headerIndex, ...mapping } = answer;
    const width = rows[headerIndex]?.length ?? 0;
    const inRange = Object.values(mapping).every((index) => index === null || index < width);
    return inRange && isUsable(mapping) ? { headerIndex, mapping } : null;
  } catch (error) {
    if (error instanceof AIUnavailableError || error instanceof AIParseError) return null;
    throw error;
  }
}

// Rows that look like ones already saved: same day, amount and direction.
async function markDuplicates(userId, rows, timeZone) {
  if (!rows.length) return;
  const dates = rows.map((row) => row.date).sort();
  const existing = await Transaction.find({
    userId,
    type: { $in: ['income', 'expense'] },
    date: {
      $gte: startOfLocalDay(dates[0], timeZone),
      $lt: startOfLocalDay(addDays(dates.at(-1), 1), timeZone),
    },
  })
    .select('type amount date')
    .lean();
  const seen = new Set(
    existing.map((t) => `${localDateOf(t.date, timeZone)}|${t.type}|${t.amount}`),
  );
  for (const row of rows) row.duplicate = seen.has(`${row.date}|${row.type}|${row.amount}`);
}

// Suggests a category once per merchant, not once per row.
async function categorizeRows(userId, rows, useAI) {
  const unique = new Map();
  for (const row of rows) {
    const key = `${row.type}|${normalizeMerchant(row.merchant) || row.description}`;
    if (!unique.has(key))
      unique.set(key, { type: row.type, merchant: row.merchant, note: row.description });
  }
  const keys = [...unique.keys()];
  const items = [...unique.values()];
  // Rules and memory for all; the AI only for the first 200 different merchants.
  const [first, rest] = [items.slice(0, AI_MERCHANT_LIMIT), items.slice(AI_MERCHANT_LIMIT)];
  const suggestions = [
    ...(await suggestCategories(userId, first, { useAI })),
    ...(rest.length ? await suggestCategories(userId, rest) : []),
  ];
  const byKey = new Map(keys.map((key, i) => [key, suggestions[i]]));
  let usedAI = false;
  for (const row of rows) {
    const suggestion = byKey.get(
      `${row.type}|${normalizeMerchant(row.merchant) || row.description}`,
    );
    row.categoryId = suggestion.categoryId;
    row.confidence = suggestion.confidence;
    row.via = suggestion.via;
    if (suggestion.via === 'ai') usedAI = true;
  }
  return usedAI;
}

// Reads the file and shows what would be imported. Nothing is saved.
// `chosen` = { headerIndex, mapping } picked by the user when our guess was wrong.
export async function previewCsv(userId, file, chosen) {
  const rows = readRows(file);
  if (!rows.length) throw badFile('The file is empty.');

  const [{ timeZone }, status] = await Promise.all([getUserPrefs(userId), aiStatus(userId)]);
  const aiAllowed = status.enabled && status.configured;

  let header = chosen ?? findHeader(rows);
  let usedAI = false;
  if (!header.mapping && aiAllowed) {
    header = (await mappingFromAI(userId, rows)) ?? header;
    usedAI = Boolean(header.mapping);
  }

  const shownHeader = header.headerIndex >= 0 ? header.headerIndex : 0;
  const base = {
    headerIndex: header.headerIndex,
    mapping: header.mapping,
    headers: rows[shownHeader] ?? [],
    sample: rows.slice(shownHeader + 1, shownHeader + 6),
  };
  // Couldn't work out the columns: the user maps them by hand.
  if (!header.mapping || !isUsable(header.mapping)) {
    return { ...base, needsMapping: true, rows: [], skipped: 0, usedAI: false };
  }

  const { rows: parsed, skipped, dayFirst } = readStatementRows(rows, header);
  await markDuplicates(userId, parsed, timeZone);
  if (await categorizeRows(userId, parsed, aiAllowed)) usedAI = true;

  return { ...base, needsMapping: false, dayFirst, rows: parsed, skipped, usedAI };
}

export async function commitCsv(userId, { walletId, keepBalance, rows }) {
  return importTransactions(userId, { walletId, keepBalance, rows });
}
