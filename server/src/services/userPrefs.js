import { User } from '../models/User.js';

export const DEFAULT_TIME_ZONE = 'Asia/Kolkata';

// The settings that decide how dates and months are read for a user.
export async function getUserPrefs(userId) {
  const user = await User.findById(userId).select('timezone monthStartDay').lean();
  return {
    timeZone: user?.timezone ?? DEFAULT_TIME_ZONE,
    monthStartDay: user?.monthStartDay ?? 1,
  };
}
