import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { ApiError } from '../utils/ApiError.js';

export const TOKEN_ISSUER = 'paisa-pal-api';
export const TOKEN_AUDIENCE = 'paisa-pal-web';

// ---- Access tokens: short-lived JWTs sent as "Authorization: Bearer <token>" ----

export function signAccessToken(userId) {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    subject: String(userId),
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    algorithm: 'HS256',
  });
}

// Returns the user id inside a valid token. Throws 401 TOKEN_EXPIRED so the client
// knows to call /auth/refresh, or 401 UNAUTHORIZED for anything else.
export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    return payload.sub;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Your session has expired');
    }
    throw ApiError.unauthorized('Invalid access token');
  }
}

// ---- Refresh tokens: random strings in an httpOnly cookie, rotated on every use ----

export function refreshTokenMaxAgeMs() {
  return env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
}

// HMAC with a server secret: the stored value is useless without the secret.
export function hashRefreshToken(rawToken) {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}

function invalidRefreshToken() {
  return new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again');
}

// Creates and stores a new refresh token. Pass `family` to continue an existing login.
export async function issueRefreshToken(userId, { family = crypto.randomUUID(), userAgent } = {}) {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  await RefreshToken.create({
    userId,
    tokenHash: hashRefreshToken(rawToken),
    family,
    expiresAt: new Date(Date.now() + refreshTokenMaxAgeMs()),
    userAgent: userAgent?.slice(0, 300),
  });
  return rawToken;
}

// Exchanges a refresh token for a new one (same family) and returns the owner's id.
// Using a token that was already exchanged means it was copied by someone else:
// the whole family is revoked so both the thief and the user are logged out.
export async function rotateRefreshToken(rawToken, { userAgent } = {}) {
  if (!rawToken) throw invalidRefreshToken();
  const tokenHash = hashRefreshToken(rawToken);
  const now = new Date();

  // Atomic "mark as used": two parallel requests can't both rotate the same token.
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, revokedReason: 'rotated' } },
  );

  if (!current) {
    const known = await RefreshToken.findOne({ tokenHash });
    if (known?.revokedReason === 'rotated' || known?.revokedReason === 'reuse') {
      await RefreshToken.updateMany(
        { family: known.family, revokedAt: null },
        { $set: { revokedAt: now, revokedReason: 'reuse' } },
      );
      throw new ApiError(
        401,
        'REFRESH_TOKEN_REUSED',
        'For your security this session was ended. Please log in again.',
      );
    }
    throw invalidRefreshToken();
  }

  const refreshToken = await issueRefreshToken(current.userId, {
    family: current.family,
    userAgent,
  });
  return { userId: current.userId, refreshToken };
}

export async function revokeRefreshToken(rawToken) {
  await RefreshToken.updateOne(
    { tokenHash: hashRefreshToken(rawToken), revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } },
  );
}
