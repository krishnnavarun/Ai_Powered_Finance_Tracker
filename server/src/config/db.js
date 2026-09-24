import mongoose from 'mongoose';
import { logger } from './logger.js';

// Reject query filters on fields that are not in the schema instead of silently ignoring them.
mongoose.set('strictQuery', true);

let listenersAttached = false;

function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));
  mongoose.connection.on('error', (err) => logger.error({ err }, 'MongoDB error'));
}

export async function connectDB(uri) {
  attachListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // Log host and db name only — the URI contains the password.
  logger.info(
    { host: mongoose.connection.host, db: mongoose.connection.name },
    'MongoDB connected',
  );
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

export function isDBConnected() {
  return mongoose.connection.readyState === 1;
}
