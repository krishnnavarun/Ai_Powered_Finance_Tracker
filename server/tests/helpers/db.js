import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { inject } from 'vitest';
import { connectDB, disconnectDB } from '../../src/config/db.js';

// Each test file gets a fresh database of its own on the shared in-memory MongoDB that
// tests/globalSetup.js starts once for the whole run.
export async function startTestDB() {
  await connectDB(inject('mongoUri'), { dbName: `test_${randomUUID().slice(0, 12)}` });
  // Build indexes (e.g. unique email) before tests rely on them.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

export async function clearTestDB() {
  const collections = Object.values(mongoose.connection.collections);
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
}

export async function stopTestDB() {
  await mongoose.connection.db?.dropDatabase();
  await disconnectDB();
}
