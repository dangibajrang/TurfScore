import { defineConfig, devices } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:15190';
const APP_URL = process.env.E2E_APP_URL || 'http://127.0.0.1:5190';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: APP_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node scripts/e2e-server.mjs',
      cwd: '../server',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        CLIENT_URL: APP_URL,
        PORT: '15190',
      },
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5190',
      cwd: '.',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        VITE_API_PROXY_TARGET: API_URL,
      },
    },
  ],
});
