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
    },
    // The first run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 180_000,
  },
});
