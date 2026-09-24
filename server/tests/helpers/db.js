import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectDB, disconnectDB } from '../../src/config/db.js';

// A throwaway in-memory MongoDB per test file — no local database or Docker needed.
// It runs as a one-node replica set because multi-document transactions
// (sign-up, wallet balance updates) only work on replica sets.
let mongo;

export async function startTestDB() {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
    // Several test files start a database at the same time; on a busy machine the
    // default 10s start-up limit is too tight.
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
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
