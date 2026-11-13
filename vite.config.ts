import { defineConfig } from 'vitest/config';

import { UNTESTED } from './coverage.untested.js';
import { models } from './vite.models.ts';

export default defineConfig({
  // Served at https://histeclipse.limits.world/ (#240). Relative, so the build also works under
  // a path, as it once did at serroba.github.io/histeclipse/: every page is index.html at the
  // site's root, so './' always resolves to the right place.
  base: './',
  plugins: [models()],
  build: {
    target: 'es2023',
    sourcemap: true,
    // three.js alone is ~500 kB minified (~140 kB gzipped); one chunk is fine for now.
    chunkSizeWarningLimit: 700,
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Browser/WebGL glue the Playwright suite covers (#625): see coverage.untested.js.
      exclude: ['src/**/*.test.ts', ...UNTESTED],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
