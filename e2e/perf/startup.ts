/**
 * What the first view costs (#220): the JavaScript the page loads before the app starts, and,
 * over cold loads on a phone profile, when the largest paint and the globe's first frame come
 * and how long the main thread ran script. Run after `pnpm build`, with nothing else busy:
 *
 *   node --experimental-strip-types e2e/perf/startup.ts [runs=5] [path=/]
 *
 * It serves dist/ itself (vite preview on PORT, default 4393) and prints a JSON summary.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { brotliCompressSync } from 'node:zlib';

import { chromium, devices, type Browser } from '@playwright/test';

declare global {
  interface Window {
    __lcp: number;
  }
}

interface Sample {
  readonly lcp: number;
  readonly firstFrame: number;
  readonly scriptMs: number;
}

const runs = Number(process.argv[2] ?? 5);
const path = process.argv[3] ?? '/';
const port = Number(process.env['PORT'] ?? 4393);

/** The entry module and the modules the page preloads with it: the startup JavaScript. */
function startupScripts(): object {
  const html = readFileSync('dist/index.html', 'utf8');
  const files = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.js)"/g)].map(
    (m) => m[1] ?? '',
  );
  const sizes = files.map((file) => {
    const bytes = readFileSync(`dist/${file}`);
    return { file, raw: bytes.length, brotli: brotliCompressSync(bytes).length };
  });
  const main = sizes.find((s) => s.file.includes('assets/index-'));
  const sum = (key: 'raw' | 'brotli'): number => sizes.reduce((total, s) => total + s[key], 0);
  return {
    main: { raw: main?.raw, brotli: main?.brotli },
    total: { raw: sum('raw'), brotli: sum('brotli') },
    files: sizes.length,
  };
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

async function serve(): Promise<ChildProcess> {
  const server = spawn(
    'pnpm',
    ['exec', 'vite', 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { stdio: 'pipe' },
  );
  for (let i = 0; i < 150; i += 1) {
    try {
      await fetch(`http://127.0.0.1:${String(port)}/`);
      return server;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error('preview did not start');
}

async function load(browser: Browser): Promise<Sample> {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  // Slow 4G: 150 ms round trip, about 6 Mbit/s down.
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 750_000,
    uploadThroughput: 94_000,
  });
  await cdp.send('Performance.enable');
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__lcp = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await page.goto(`http://127.0.0.1:${String(port)}${path}`);
  const globe = await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="globe"][data-rendered="true"]') !== null &&
      performance.now(),
    undefined,
    { timeout: 90_000, polling: 50 },
  );
  const firstFrame = Number(await globe.jsonValue());
  await page.waitForTimeout(1000);
  const lcp = await page.evaluate(() => window.__lcp);
  const { metrics } = await cdp.send('Performance.getMetrics');
  const script = metrics.find((m) => m.name === 'ScriptDuration')?.value ?? 0;
  await context.close();
  return { lcp, firstFrame, scriptMs: script * 1000 };
}

const server = await serve();
try {
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
  });
  await load(browser); // a warm-up for the server, not counted
  const samples = [];
  for (let i = 0; i < runs; i += 1) samples.push(await load(browser));
  await browser.close();
  const round = (n: number): number => Math.round(n);
  // The report is what this prints: the one console line it has.
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        path,
        runs,
        startupJs: startupScripts(),
        medianMs: {
          lcp: round(median(samples.map((s) => s.lcp))),
          globeFirstFrame: round(median(samples.map((s) => s.firstFrame))),
          script: round(median(samples.map((s) => s.scriptMs))),
        },
        samples: samples.map((s) => ({
          lcp: round(s.lcp),
          globe: round(s.firstFrame),
          script: round(s.scriptMs),
        })),
      },
      null,
      2,
    ),
  );
} finally {
  server.kill();
}
