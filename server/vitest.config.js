import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Tests never read server/.env — they get a fixed, safe environment.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/paisa-pal-test',
      CLIENT_URL: 'http://localhost:5173',
      REDIS_URL: '',
      // Test-only secrets — never used outside the test run.
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnop',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmno',
      // Low bcrypt cost keeps auth tests fast; real runs use 12.
      BCRYPT_ROUNDS: '4',
      // Receipt photos go to a throwaway folder, never server/uploads.
      RECEIPT_STORAGE: 'local',
      UPLOAD_DIR: path.join(os.tmpdir(), 'paisa-pal-test-uploads'),
    },
    // The first run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 180_000,
  },
});
