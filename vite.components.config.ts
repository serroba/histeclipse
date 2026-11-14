import { defineConfig } from 'vite';

/** Test-only source fixtures: no application startup or model downloads. */
export default defineConfig({
  optimizeDeps: { entries: ['e2e/components/sheet.html'] },
  server: { host: '127.0.0.1', port: 4174, strictPort: true },
});
