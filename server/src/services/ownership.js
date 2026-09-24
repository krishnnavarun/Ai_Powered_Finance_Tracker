import { ApiError } from '../utils/ApiError.js';

// Loads a document only if it belongs to the user. Someone else's document gives the
// same 404 as a missing one, so ids can't be probed to learn what exists.
export async function findOwnedOrThrow(Model, userId, id, { label = 'Item', session } = {}) {
  const doc = await Model.findOne({ _id: id, userId }).session(session ?? null);
  if (!doc) throw ApiError.notFound(`${label} not found`);
  return doc;
}

// Turns a unique-name clash from MongoDB into a friendly 409.
export async function withUniqueName(operation, message) {
  try {
    return await operation();
  } catch (err) {
    if (err?.code === 11000) throw new ApiError(409, 'DUPLICATE_NAME', message);
    throw err;
  }
}
