import { ApiError } from '../utils/ApiError.js';

// No provider key is set up on the server, or the provider is down.
export class AIUnavailableError extends ApiError {
  constructor(message = 'AI is not available right now. You can still add things by hand.') {
    super(503, 'AI_UNAVAILABLE', message);
    this.name = 'AIUnavailableError';
  }
}

// The user turned AI off in Settings.
export class AIDisabledError extends ApiError {
  constructor() {
    super(403, 'AI_DISABLED', 'AI is turned off in Settings.');
    this.name = 'AIDisabledError';
  }
}

// The AI answered, but not in the shape we asked for (even after one retry).
export class AIParseError extends ApiError {
  constructor(message = 'The AI gave an answer we could not read. Please try again.') {
    super(502, 'AI_PARSE_ERROR', message);
    this.name = 'AIParseError';
  }
}

// A provider HTTP call failed. `retryable` = worth trying again (rate limit, 5xx, network).
export class LLMRequestError extends Error {
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = 'LLMRequestError';
    this.status = status;
    this.retryable = retryable;
  }
}
