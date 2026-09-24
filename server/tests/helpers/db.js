import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../../src/config/db.js';

// A throwaway in-memory MongoDB per test file — no local database or Docker needed.
let mongo;

export async function startTestDB() {
  mongo = await MongoMemoryServer.create();
  await connectDB(mongo.getUri());
  // Build indexes (e.g. unique email) before tests rely on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function stopTestDB() {
  await disconnectDB();
  await mongo?.stop();
}
