import { defineConfig, devices } from '@playwright/test';

// Deliberately unusual port so an unrelated local dev server can never be reused.
const PORT = Number(process.env.E2E_PORT ?? 4517);
const BASE_URL = `http://127.0.0.1:${PORT}`;
/** Optional local HTTP proxy for networks that cannot reach the exchanges directly. */
const PROXY = process.env.E2E_PROXY ?? '';
const withProxy = PROXY ? { proxy: { server: PROXY, bypass: '127.0.0.1,localhost' } } : {};

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Deterministic UI tests against intercepted (fixture) exchange responses.
      name: 'desktop',
      testMatch: /(ui|probe2)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: /ui\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
    {
      // Real exchange APIs. Requires outbound network access.
      name: 'live',
      testMatch: /live\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: withProxy },
    },
    {
      // README screenshots, captured from the real deployed-behaviour build.
      name: 'screenshots',
      testMatch: /screenshots\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], launchOptions: withProxy },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 90_000,
  },
});
