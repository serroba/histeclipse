import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://serroba.github.io/histeclipse/
  base: '/histeclipse/',
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
      // Browser/WebGL glue: the Playwright suite in e2e/ covers it in a real browser. Keep
      // these files thin and put logic in unit-tested modules.
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/app.ts',
        'src/globe/scene.ts',
        'src/globe/solarShaders.ts',
        'src/globe/empireCanvas.ts',
        'src/sky/skyScene.ts',
        'src/ui/**',
      ],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
