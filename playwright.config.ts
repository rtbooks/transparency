import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 * Uses Next.js dev server on port 3001 (separate from dev) with test database.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Global Clerk setup — must run first
    {
      name: 'global-setup',
      testMatch: /global\.setup\.ts/,
    },
    // Auth setup — creates storageState files
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.ts/,
      dependencies: ['global-setup'],
    },
    // Desktop Chrome (authenticated)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
      testIgnore: /.*\.public\.spec\.ts/,
    },
    // Mobile Chrome (responsive testing, authenticated)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
      testMatch: /.*\.responsive\.spec\.ts/,
    },
    // Public pages — no auth needed
    {
      name: 'public',
      testMatch: /.*\.public\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['global-setup'],
    },
  ],

  webServer: {
    command: 'npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
