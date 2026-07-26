import { defineConfig, devices } from '@playwright/test';

// chaos-atlas is a static export (next.config.js: output: 'export'), so the
// most reliable way to exercise it in e2e is to build once and serve the
// static `out/` directory rather than run the Next dev server. `next start`
// refuses to run against an `output: 'export'` build, so we use Python's
// stdlib http.server instead of adding a dependency for this.
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && python3 -m http.server ${PORT} --directory out`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
