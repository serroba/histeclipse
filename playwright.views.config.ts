import { defineConfig, devices } from '@playwright/test';

/**
 * The views compared between two builds (#628, e2e/views): captured from `VIEWS_URL` into
 * `VIEWS_DIR`. The base build's captures are written with `--update-snapshots`; the branch's
 * are compared with them, and any difference fails with the expected, actual and diff images
 * in test-results/. Run both through `pnpm compare:views <base-url> <branch-url>`.
 */
const url = process.env['VIEWS_URL'];
if (url === undefined) throw new Error('VIEWS_URL: the build to capture');

export default defineConfig({
  testDir: 'e2e/views',
  fullyParallel: true,
  retries: 0,
  // Software WebGL on a busy machine: a view can take a while to settle.
  timeout: 180_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'test-results/views-report' }]],
  outputDir: 'test-results/views',
  snapshotPathTemplate: `${process.env['VIEWS_DIR'] ?? 'test-results/views-base'}/{arg}{ext}`,
  use: {
    baseURL: url,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    timezoneId: 'UTC',
    locale: 'en-US',
    // The site's own analytics can tell a capture from a reader (#348).
    userAgent: `${devices['Desktop Chrome'].userAgent} histeclipse-live-test`,
  },
});
