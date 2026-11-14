import { defineConfig, devices } from '@playwright/test';

import type { DisplayOptions } from './e2e/support';

// With BASE_URL set (e.g. the live site, https://histeclipse.limits.world/) the suite tests that deployment.
// Without it, the suite builds the site and tests a local production preview.
const remoteBaseURL = process.env['BASE_URL'];
const localBaseURL = 'http://localhost:4173/';
const isCI = process.env['CI'] !== undefined;
const acceptance = process.env['E2E_SCOPE'] === 'acceptance';

/**
 * Against the live site, each browser says it is a test, so the site's analytics can tell the
 * suite from readers (#348). The device's own user agent stays in front, as sites read it.
 */
function device(name: string): (typeof devices)[string] {
  const profile = devices[name];
  if (profile === undefined) throw new Error(`No such device: ${name}`);
  return remoteBaseURL === undefined
    ? profile
    : { ...profile, userAgent: `${profile.userAgent} histeclipse-live-test` };
}

export default defineConfig<DisplayOptions>({
  testDir: 'e2e',
  testIgnore: '**/gpu/**',
  // Tests, not files, are shared out among workers and CI's shards: one long file (the smoke
  // tests) would otherwise keep a shard going long after the others.
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // A render on a busy machine (a full run's workers, or software WebGL) can take more than
  // the default 5 s; a check that fails still fails, only later (#306).
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['list'], ['html', { open: 'never' }], ['./e2e/timingReporter.ts']]
    : 'list',
  use: {
    baseURL: remoteBaseURL ?? localBaseURL,
    trace: 'retain-on-failure',
    // A first visit turns to the reader's time zone; UTC has no place, so the usual first view
    // holds wherever the suite runs. Scenarios about the time zone pick their own.
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'desktop',
      ...(acceptance && { grep: /@acceptance/ }),
      use: { ...device('Desktop Chrome') },
    },
    { name: 'mobile', ...(acceptance && { grep: /@mobile/ }), use: { ...device('Pixel 7') } },
    // Only two scheduling/wiring checks repeat at 120 Hz. Pace and edge cases run with
    // explicit frame timestamps in scheduledPlayback.test.ts, not whole spec files.
    {
      name: 'desktop-120hz',
      testMatch: /(history|playback)\.spec\.ts$/,
      grep: /playing history moves through the years and names the states that come and go|deep time has speeds in the units of its span, and plays at the one picked/,
      use: { ...device('Desktop Chrome'), refreshRate: 120 },
    },
  ],
  ...(remoteBaseURL === undefined && {
    webServer: [
      {
        command: 'pnpm build && pnpm preview --port 4173 --strictPort',
        url: localBaseURL,
        // Never reuse a server that is already running: it may be serving an older build.
        reuseExistingServer: false,
      },
      {
        command: 'pnpm exec vite --config vite.components.config.ts',
        url: 'http://127.0.0.1:4174/e2e/components/sheet.html',
        reuseExistingServer: false,
      },
    ],
  }),
});
