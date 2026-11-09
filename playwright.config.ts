import { defineConfig, devices } from '@playwright/test';

import type { DisplayOptions } from './e2e/support';

// With BASE_URL set (e.g. the live site, https://histeclipse.limits.world/) the suite tests that deployment.
// Without it, the suite builds the site and tests a local production preview.
const remoteBaseURL = process.env['BASE_URL'];
const localBaseURL = 'http://localhost:4173/';
const isCI = process.env['CI'] !== undefined;

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
  // Tests, not files, are shared out among workers and CI's shards: one long file (the smoke
  // tests) would otherwise keep a shard going long after the others.
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  // A render on a busy machine (a full run's workers, or software WebGL) can take more than
  // the default 5 s; a check that fails still fails, only later (#306).
  expect: { timeout: 10_000 },
  reporter: isCI ? [['github'], ['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: remoteBaseURL ?? localBaseURL,
    trace: 'retain-on-failure',
    // A first visit turns to the reader's time zone; UTC has no place, so the usual first view
    // holds wherever the suite runs. Scenarios about the time zone pick their own.
    timezoneId: 'UTC',
  },
  projects: [
    { name: 'desktop', use: { ...device('Desktop Chrome') } },
    { name: 'mobile', use: { ...device('Pixel 7') } },
    // The journeys and the time features again, on a 120 Hz display: animation that counts
    // frames instead of time shows up there (deep time once stalled at 120 Hz).
    {
      name: 'desktop-120hz',
      testMatch: /(journeys|time|layers|ice|history)\.spec\.ts$/,
      use: { ...device('Desktop Chrome'), refreshRate: 120 },
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
