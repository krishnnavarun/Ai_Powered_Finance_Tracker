import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';

async function findUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.unauthorized('Account not found');
  return user;
}

export async function updateProfile(userId, changes) {
  const user = await findUser(userId);
  user.set(changes);
  await user.save();
  return user;
}

// Settings are merged one field at a time, so turning off the digest email
// doesn't reset the AI switch.
export async function updateSettings(userId, changes) {
  const user = await findUser(userId);
  for (const [key, value] of Object.entries(changes)) user.settings[key] = value;
  await user.save();
  return user;
}
