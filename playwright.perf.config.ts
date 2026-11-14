import { defineConfig, devices } from '@playwright/test';

/**
 * The rendering audit (#661): e2e/perf's scenario matrix against the production build, on this
 * machine's real GPU. Never in CI: its numbers are for comparing builds on one machine.
 * `pnpm build && pnpm exec playwright test --config playwright.perf.config.ts`
 */
const PORT = Number(process.env['PERF_PORT'] ?? 4187);
const gpuArgs = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];

export default defineConfig({
  testDir: 'e2e/perf',
  testMatch: /\.perf\.ts$/,
  outputDir: 'test-results/rendering-audit-runs',
  // One at a time: parallel pages would share and skew the GPU and the main threads.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}/`,
    timezoneId: 'UTC',
    launchOptions: { args: gpuArgs },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Pixel 7's screen with the CPU slowed fourfold (CPU_THROTTLE overrides); the GPU stays fast.
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 412, height: 915 },
        deviceScaleFactor: 2.625,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${String(PORT)} --strictPort`,
    url: `http://127.0.0.1:${String(PORT)}/`,
    reuseExistingServer: false,
  },
});
