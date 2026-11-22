import { defineConfig } from '@playwright/test';

// Disable webServer - we can't run local server in this sandbox
const useWebServer = false;

// Try Chromium with all sandbox/Gpu disabling flags including --single-process
const commonBrowserConfig = {
  browserName: 'chromium' as const,
  // Use bundled Chromium
  headless: true,
  launchOptions: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-crash-reporter',
    ],
  },
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    ...commonBrowserConfig,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...commonBrowserConfig,
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'chromium',
      use: { 
        ...commonBrowserConfig,
        viewport: { width: 1280, height: 720 },
      },
      dependencies: ['setup'],
    },
  ],
  ...(useWebServer && {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        NODE_ENV: 'test',
      },
    },
  }),
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  globalSetup: require.resolve('./tests/global-setup'),
  globalTeardown: require.resolve('./tests/global-teardown'),
});
