import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { seedDefaultCategories } from './category.service.js';
import {
  issueRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from './token.service.js';

// Compared against when the email doesn't exist, so a wrong email takes as long as a
// wrong password — response timing can't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('paisa-pal-timing-dummy', env.BCRYPT_ROUNDS);

function emailTaken() {
  return new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
}

async function startSession(user, { userAgent } = {}) {
  const refreshToken = await issueRefreshToken(user._id, { userAgent });
  return { user, accessToken: signAccessToken(user._id), refreshToken };
}

export async function register({ name, email, password }, meta) {
  if (await User.exists({ email })) throw emailTaken();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let user;
  try {
    // User + default categories are saved together or not at all.
    user = await mongoose.connection.transaction(async (session) => {
      const [created] = await User.create([{ name, email, passwordHash }], { session });
      await seedDefaultCategories(created._id, { session });
      return created;
    });
  } catch (err) {
    // Two sign-ups with the same email at the same moment: the unique index catches it.
    if (err?.code === 11000) throw emailTaken();
    throw err;
  }
  return startSession(user, meta);
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password');
  }
  return startSession(user, meta);
}

export async function refresh(rawRefreshToken, meta) {
  const { userId, refreshToken } = await rotateRefreshToken(rawRefreshToken, meta);
  const user = await User.findById(userId);
  if (!user) throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Please log in again');
  return { user, accessToken: signAccessToken(user._id), refreshToken };
}

export async function logout(rawRefreshToken) {
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
}

export async function getCurrentUser(userId) {
  const user = await User.findById(userId);
  // The account was deleted while the access token was still valid.
  if (!user) throw ApiError.unauthorized('Account not found');
  return user;
}
