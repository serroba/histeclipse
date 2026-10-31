import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Served from https://serroba.github.io/histeclipse/
  base: '/histeclipse/',
  build: {
    target: 'es2023',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts is DOM bootstrap; it gets covered by browser end-to-end tests instead.
      exclude: ['src/**/*.test.ts', 'src/main.ts'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
