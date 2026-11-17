import { defineConfig, devices } from '@playwright/test';

// Disable webServer in this environment due to port binding restrictions
const useWebServer = process.env.USE_WEB_SERVER === 'true';

/**
 * Browser Configuration for macOS
 * 
 * NOTE: This sandbox environment has fundamental limitations:
 * - Mach port rendezvous permission denied (headless shell)
 * - Crashpad settings.dat access denied (Chrome)
 * - WebKit Abort trap: 6
 * 
 * These are macOS sandbox restrictions that cannot be resolved in this environment.
 * 
 * For local development/CI/Docker, use one of these configurations:
 * 
 * Option A: Chrome (recommended for local macOS)
 * - Requires: Chrome installed, "Full Disk Access" granted to Terminal/Chrome
 * - Set headless: false for best compatibility
 * 
 * Option B: Firefox (most reliable on macOS)
 * - Requires: Firefox installed
 * - Works in headless mode on most macOS versions
 * 
 * Option C: Playwright's Chromium with dependencies (CI/Docker)
 * - Run: npx playwright install-deps (Linux only)
 * - Works in headless mode in CI/Docker
 * 
 * Option D: WebKit (Safari) - requires Safari automation enabled
 */

// Default: Chrome with channel (best for local macOS with proper permissions)
const commonBrowserConfig = {
  browserName: 'chromium' as const,
  channel: 'chrome', // Use system Chrome instead of bundled headless shell
  headless: process.env.CI ? true : false, // Headed locally, headless in CI
  launchOptions: {
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8080',
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
    // Alternative: Firefox project (uncomment to use)
    // {
    //   name: 'firefox',
    //   use: { 
    //     browserName: 'firefox',
    //     headless: true,
    //     viewport: { width: 1280, height: 720 },
    //   },
    //   dependencies: ['setup'],
    // },
    // Alternative: WebKit project (uncomment to use)
    // {
    //   name: 'webkit',
    //   use: { 
    //     browserName: 'webkit',
    //     headless: true,
    //     viewport: { width: 1280, height: 720 },
    //   },
    //   dependencies: ['setup'],
    // },
  ],
  ...(useWebServer && {
    webServer: {
      command: 'npm run dev',
      url: 'http://localhost:8080',
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
