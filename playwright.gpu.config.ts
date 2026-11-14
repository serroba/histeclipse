import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';

/** Component GPU probes use production factories via Vite, separate from the production acceptance build. */
export default defineConfig({
  ...base,
  testDir: 'e2e/gpu',
  outputDir: 'test-results/gpu-components',
  testIgnore: [],
  use: { ...base.use, baseURL: 'http://127.0.0.1:4174/' },
  projects: [{ name: 'gpu-components', use: { ...devices['Desktop Chrome'] } }],
  workers: 1,
  webServer: {
    command: 'pnpm exec vite --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/e2e/gpu/index.html',
    reuseExistingServer: false,
  },
});
