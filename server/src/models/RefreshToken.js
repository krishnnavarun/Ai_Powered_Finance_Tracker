import mongoose from 'mongoose';

// One row per issued refresh token. The raw token lives only in the user's httpOnly
// cookie; we store an HMAC of it, so a database leak alone can't be used to log in.
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    // All tokens from one login share a family. Reusing an already-rotated token
    // revokes the whole family (it means the token was stolen).
    family: { type: String, required: true, index: true },
    // MongoDB deletes the row automatically once this date passes (TTL index below).
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 300 },
    revokedAt: { type: Date, default: null },
    // 'rotated' = exchanged for a new token (reusing it later means theft),
    // 'logout' = user logged out, 'reuse' = revoked because theft was detected.
    revokedReason: { type: String, enum: ['rotated', 'logout', 'reuse'], default: null },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
