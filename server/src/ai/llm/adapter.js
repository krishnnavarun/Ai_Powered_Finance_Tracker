import { z } from 'zod';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AIParseError, AIUnavailableError, LLMRequestError } from '../errors.js';
import { maskPII } from '../piiMasker.js';
import { createGeminiProvider } from './gemini.js';
import { createOllamaProvider } from './ollama.js';
import {
  createOpenAICompatibleProvider,
  GROQ_BASE_URL,
  OPENAI_BASE_URL,
} from './openaiCompatible.js';

// Models used when LLM_MODEL_FAST / LLM_MODEL_SMART are empty. "fast" is for parsing
// (cheap, quick); "smart" is for the chat assistant.
export const DEFAULT_MODELS = {
  gemini: { fast: 'gemini-flash-lite-latest', smart: 'gemini-flash-latest' },
  openai: { fast: 'gpt-4.1-mini', smart: 'gpt-4.1' },
  groq: { fast: 'llama-3.1-8b-instant', smart: 'llama-3.3-70b-versatile' },
  ollama: { fast: 'llama3.2', smart: 'llama3.2' },
};

// Builds the provider chosen in the environment, or null when its key is missing.
export function createProviderFromEnv(config = env, { fetchImpl, retryDelaysMs } = {}) {
  const name = config.LLM_PROVIDER;
  const models = {
    fast: config.LLM_MODEL_FAST || DEFAULT_MODELS[name].fast,
    smart: config.LLM_MODEL_SMART || config.LLM_MODEL_FAST || DEFAULT_MODELS[name].smart,
  };
  const common = { models, timeoutMs: config.LLM_TIMEOUT_MS, retryDelaysMs, fetchImpl };

  if (name === 'gemini') {
    return config.GEMINI_API_KEY
      ? createGeminiProvider({ ...common, apiKey: config.GEMINI_API_KEY })
      : null;
  }
  if (name === 'openai' || name === 'groq') {
    const apiKey = name === 'openai' ? config.OPENAI_API_KEY : config.GROQ_API_KEY;
    const baseUrl = name === 'openai' ? OPENAI_BASE_URL : GROQ_BASE_URL;
    return apiKey ? createOpenAICompatibleProvider({ ...common, name, baseUrl, apiKey }) : null;
  }
  return createOllamaProvider({ ...common, baseUrl: config.OLLAMA_BASE_URL });
}

// The provider in use. Tests swap in a fake with setLLMProvider().
let provider;
let providerOverridden = false;

export function getLLMProvider() {
  if (!providerOverridden && provider === undefined) provider = createProviderFromEnv();
  return provider;
}

// Tests only: use this provider (or null = "AI not configured") until reset.
export function setLLMProvider(fake) {
  provider = fake;
  providerOverridden = true;
}

export function resetLLMProvider() {
  provider = undefined;
  providerOverridden = false;
}

export function isAIConfigured() {
  return Boolean(getLLMProvider());
}

// Reads JSON from a model reply, tolerating ```json fences or a sentence around it.
export function parseJSONText(text) {
  const trimmed = String(text ?? '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.search(/[[{]/);
    const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'));
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function schemaText(schema) {
  try {
    return JSON.stringify(z.toJSONSchema(schema, { unrepresentable: 'any' }));
  } catch {
    return null; // schemas with custom checks can't always be described; Zod still validates
  }
}

function describeIssues(error) {
  return error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}

// Asks the model for JSON and returns it only once it passes `schema` (a Zod schema).
//   system  — instructions (ours; never user data)
//   user    — the request, with user data wrapped by asData(); personal details are
//             masked here, so no caller can forget
//   image   — optional { mimeType, base64 } for receipts
//   tier    — 'fast' | 'smart'
// A reply that doesn't fit the schema is sent back once with the problems listed; a
// second bad reply throws AIParseError. Provider failures throw AIUnavailableError, so
// callers can fall back to the manual way.
export async function generateJSON({
  system,
  user,
  schema,
  image,
  tier = 'fast',
  userId,
  purpose,
}) {
  const llm = getLLMProvider();
  if (!llm) throw new AIUnavailableError('AI is not set up on this server.');

  const { text: maskedUser, counts } = maskPII(user);
  const shape = schemaText(schema);
  const fullSystem = [
    system,
    'Reply with one JSON value only, no other text.',
    shape && `It must match this JSON Schema:\n${shape}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  let prompt = maskedUser;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const started = Date.now();
    let reply;
    try {
      reply = await llm.complete({ system: fullSystem, user: prompt, image, json: true, tier });
    } catch (error) {
      logger.warn(
        { userId, purpose, provider: llm.name, status: error.status, err: error.message },
        'llm call failed',
      );
      if (error instanceof LLMRequestError) throw new AIUnavailableError();
      throw error;
    }
    // Usage per user for cost tracking. Counts only — never the prompt or the answer.
    logger.info(
      {
        userId,
        purpose,
        provider: llm.name,
        model: reply.model,
        attempt,
        ms: Date.now() - started,
        inputTokens: reply.usage?.inputTokens,
        outputTokens: reply.usage?.outputTokens,
        masked: counts,
      },
      'llm call',
    );

    const parsed = schema.safeParse(parseJSONText(reply.text));
    if (parsed.success) return parsed.data;

    const problems =
      parseJSONText(reply.text) === undefined
        ? 'it was not valid JSON'
        : describeIssues(parsed.error);
    prompt = `${maskedUser}\n\nYour previous reply could not be used because ${problems}. Reply again with JSON that matches the schema exactly.`;
  }
  throw new AIParseError();
}
