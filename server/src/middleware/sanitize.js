// Removes keys that could inject MongoDB operators or pollute prototypes, e.g.
// { "email": { "$gt": "" } } or { "__proto__": { ... } }. Runs on body and query
// before any route sees them. (Replaces express-mongo-sanitize, which does not support Express 5.)

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isUnsafeKey(key) {
  return key.startsWith('$') || key.includes('.') || BLOCKED_KEYS.has(key);
}

export function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (value !== null && typeof value === 'object') {
    const clean = {};
    for (const [key, inner] of Object.entries(value)) {
      if (!isUnsafeKey(key)) clean[key] = sanitize(inner);
    }
    return clean;
  }
  return value;
}

export function sanitizeRequest(req, _res, next) {
  if (req.body !== undefined) req.body = sanitize(req.body);
  // In Express 5 req.query is a getter that re-parses the URL, so replace it with a plain value.
  Object.defineProperty(req, 'query', {
    value: sanitize(req.query),
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
}
