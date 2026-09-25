import { LLMRequestError } from '../errors.js';
import { DEFAULT_RETRY_DELAYS_MS } from './http.js';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// POSTs JSON and returns the open streaming response. Only the start is retried (rate
// limits, 5xx, network); once text has started flowing, a failure ends the answer.
export async function openStream(
  url,
  { headers = {}, body, timeoutMs, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS, fetchImpl = fetch },
) {
  let lastError;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      lastError = new LLMRequestError(`AI provider replied ${res.status}`, {
        status: res.status,
        retryable: RETRYABLE_STATUS.has(res.status),
      });
      if (!lastError.retryable) throw lastError;
    } catch (error) {
      if (error instanceof LLMRequestError && !error.retryable) throw error;
      if (!(error instanceof LLMRequestError)) {
        lastError = new LLMRequestError('Could not reach the AI provider', { retryable: true });
      }
    }
    if (attempt < retryDelaysMs.length) await sleep(retryDelaysMs[attempt]);
  }
  throw lastError;
}

// Reads a response body line by line (works for server-sent events and NDJSON).
export async function* readLines(res) {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let newline = buffer.indexOf('\n');
      while (newline !== -1) {
        yield buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf('\n');
      }
    }
  } catch {
    throw new LLMRequestError('The AI answer was cut off');
  }
  if (buffer.trim()) yield buffer;
}

// Server-sent events: yields the parsed JSON of each "data:" line ("[DONE]" ends it).
export async function* readSSE(res) {
  for await (const line of readLines(res)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === '[DONE]') return;
    try {
      yield JSON.parse(data);
    } catch {
      // a keep-alive or partial line; skip it
    }
  }
}
