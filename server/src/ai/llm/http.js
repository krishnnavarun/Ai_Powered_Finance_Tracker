import { LLMRequestError } from '../errors.js';

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
export const DEFAULT_RETRY_DELAYS_MS = [600, 2000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long the provider asked us to wait (Retry-After seconds), capped at 5 s.
function retryAfterMs(res) {
  const seconds = Number(res.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5000) : null;
}

// POSTs JSON and returns the parsed reply. Each attempt has its own timeout.
// Rate limits (429), server errors (5xx) and network failures are retried after the
// given delays; other errors (bad key, bad request) fail at once.
export async function postJSON(
  url,
  { headers = {}, body, timeoutMs, retryDelaysMs = DEFAULT_RETRY_DELAYS_MS, fetchImpl = fetch },
) {
  let lastError;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    let wait = retryDelaysMs[attempt];
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.json();

      const retryable = RETRYABLE_STATUS.has(res.status);
      // Only the status goes in the message; provider error bodies can echo our prompt.
      lastError = new LLMRequestError(`AI provider replied ${res.status}`, {
        status: res.status,
        retryable,
      });
      if (!retryable) throw lastError;
      wait = retryAfterMs(res) ?? wait;
    } catch (error) {
      if (error instanceof LLMRequestError && !error.retryable) throw error;
      if (!(error instanceof LLMRequestError)) {
        const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
        lastError = new LLMRequestError(
          timedOut ? 'AI provider timed out' : 'Could not reach the AI provider',
          { retryable: true },
        );
      }
    }
    if (attempt < retryDelaysMs.length) await sleep(wait);
  }
  throw lastError;
}
