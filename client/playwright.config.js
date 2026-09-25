import { defineConfig, devices } from '@playwright/test';

// Browser tests of the whole app: the real client (Vite) talking to the real API, which
// runs on an in-memory database with a pretend AI (server/scripts/e2e-server.js).
// Run: npm run e2e  (first time: npx playwright install chromium)
const API_PORT = 5055;
const WEB_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    // Calm, repeatable runs.
    reducedMotion: 'reduce',
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /screenshots.spec.js/,
    },
    // README pictures: npm run screenshots
    {
      name: 'screenshots',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /screenshots.spec.js/,
    },
  ],
  webServer: [
    {
      command: 'npm run e2e:server',
      cwd: '../server',
      url: `http://localhost:${API_PORT}/api/health`,
      env: { E2E_PORT: String(API_PORT) },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
