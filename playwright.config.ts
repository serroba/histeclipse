import { defineConfig, devices } from '@playwright/test';

import type { DisplayOptions } from './e2e/support';

// With BASE_URL set (e.g. the live GitHub Pages URL) the suite tests that deployment.
// Without it, the suite builds the site and tests a local production preview.
const remoteBaseURL = process.env['BASE_URL'];
const localBaseURL = 'http://localhost:4173/histeclipse/';
const isCI = process.env['CI'] !== undefined;

export default defineConfig<DisplayOptions>({
  testDir: 'e2e',
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseURL ?? localBaseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // The journeys and the time features again, on a 120 Hz display: animation that counts
    // frames instead of time shows up there (deep time once stalled at 120 Hz).
    {
      name: 'desktop-120hz',
      testMatch: /(journeys|time|layers|ice)\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], refreshRate: 120 },
    },
  ],
  ...(remoteBaseURL === undefined && {
    webServer: {
      command: 'pnpm build && pnpm preview --port 4173 --strictPort',
      url: localBaseURL,
      // Never reuse a server that is already running: it may be serving an older build.
      reuseExistingServer: false,
    },
  }),
});
