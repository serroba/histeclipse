import { installVirtualDisplay } from './virtualDisplay';
/** Steps shared by the end-to-end features, and the test they run in. */

import { expect, test as base, type Locator, type Page, type Request } from '@playwright/test';

export { expect };

/**
 * The scenarios run against the live site after each deploy (#348): what production adds to
 * the build CI tested (the host, the domain, the edge's cache and headers, a stale page after a
 * release). The daily live run, like CI, runs everything.
 */
export const LIVE = { tag: '@live' };
/**
 * The tests that between them draw every shader once: the globe's, the sky's, the 3D stories'
 * and the 3D charts'. They run on a Mac in every pull request, where a shader can fail to compile
 * that compiles on Linux (#110); the rest of the suite runs there nightly.
 */
export const GPU = { tag: '@gpu' };
export const LIVE_GPU = { tag: ['@live', '@gpu'] };

/**
 * What the live site sends elsewhere, and only the live site: telemetry to Honeycomb (stubbed
 * below) and the analytics beacon Cloudflare's edge adds to the page. Nothing a feature needs.
 */
export const LIVE_TELEMETRY_HOSTS: readonly string[] = [
  'api.honeycomb.io',
  'static.cloudflareinsights.com',
];

/** Whether `url` is the live site's telemetry: to Honeycomb, Cloudflare's beacon or its posts. */
function liveTelemetry(url: string): boolean {
  const { host, pathname } = new URL(url);
  return LIVE_TELEMETRY_HOSTS.includes(host) || pathname.startsWith('/cdn-cgi/rum');
}

export interface DisplayOptions {
  /** Frames per second the display gives, exactly; null for the browser's own. */
  readonly refreshRate: number | null;
}

/**
 * Playwright's test, with the display's refresh rate as a project option: a 120 Hz project
 * runs the features with frames at that rate, as a fast Mac or phone gives them.
 */
export const test = base.extend<DisplayOptions>({
  refreshRate: [null, { option: true }],
  page: async ({ page, refreshRate }, use) => {
    // The live site exports telemetry; keep test runs out of the real data.
    await page.route('https://api.honeycomb.io/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    if (refreshRate !== null) {
      await page.addInitScript(installVirtualDisplay, refreshRate);
    }
    await use(page);
  },
});

export function collectProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`uncaught: ${error.message}`));
  const loaded = new Set<string>();
  page.on('requestfinished', (request) => loaded.add(request.url()));
  page.on('requestfailed', (request) => {
    const url = request.url();
    const error = request.failure()?.errorText ?? '';
    if (liveTelemetry(url)) return;
    // The live site's data may be served stale while revalidated (`stale-while-revalidate`): the
    // page has its copy, and the browser's check behind it can be dropped, so a test failed or
    // passed by how old the edge's copy was. Only one already loaded is let pass.
    if (error === 'net::ERR_ABORTED' && loaded.has(url)) return;
    problems.push(`request failed: ${url} ${error}`.trim());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.push(`HTTP ${String(response.status())}: ${response.url()}`);
    }
  });
  return problems;
}

/**
 * Waits until no request the page made is still out, for a moment. Unlike `networkidle`, a
 * request is let pass once its URL has loaded: the files the page preloads by hand
 * (`boot-preloads` in index.html) are fetched again by the app, served from the preload, and
 * Playwright never hears that second request end, so on the live site `networkidle` never came
 * and the daily run failed (#1295). Call before the page goes anywhere, await `settled` after.
 */
export function watchLoads(page: Page): { settled: () => Promise<void> } {
  const loaded = new Set<string>();
  const out = new Set<Request>();
  page.on('request', (request) => out.add(request));
  page.on('requestfinished', (request) => {
    out.delete(request);
    loaded.add(request.url());
  });
  page.on('requestfailed', (request) => out.delete(request));
  const pending = (): number => [...out].filter((request) => !loaded.has(request.url())).length;
  return {
    settled: async () => {
      let quietSince = Date.now();
      await expect
        .poll(
          () => {
            if (pending() > 0) quietSince = Date.now();
            return Date.now() - quietSince;
          },
          { timeout: 20_000, intervals: [100] },
        )
        .toBeGreaterThanOrEqual(500);
    },
  };
}

export async function globeRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('globe')).toHaveAttribute('data-rendered', 'true');
}

/** Source credits sit under a "Sources" toggle in the date panel: open it. */
export async function openSources(page: Page): Promise<void> {
  const sources = page.locator('.credits');
  if ((await sources.getAttribute('open')) === null) await sources.locator('summary').click();
}

/** Open the Layers panel, unless it is open already. */
export async function openLayers(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: 'Layers', exact: true });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(page.getByRole('dialog', { name: 'Layers' })).toBeVisible();
}

/**
 * Turn a layer on (#1137): from Layers, ticked in its panel by its name there (`Impact craters`),
 * which then closes.
 */
export async function turnOnLayer(page: Page, name: string, on = true): Promise<void> {
  await openLayers(page);
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await panel.getByRole('checkbox', { name, exact: true }).setChecked(on);
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();
}

/** Open the deep-time bar's details (folded until opened), unless they are open already. */
export async function showDeepDetails(page: Page): Promise<void> {
  const handle = page.getByRole('navigation', { name: 'Deep time' }).locator('.deep-handle');
  await expect(handle).toBeVisible();
  if ((await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  await expect(page.getByTestId('deep-details')).toBeVisible();
}

/**
 * Pick how far back time reaches, in the time bar's scale row (#1116): Years, Ice ages, 540 Myr,
 * 4.6 Gyr. On a phone a chip opens them first.
 */
export async function pickSpan(page: Page, span: string): Promise<void> {
  const chip = page.locator('.time-scale-chip').filter({ visible: true });
  if ((await chip.count()) > 0) await chip.click();
  await page
    .getByRole('group', { name: 'Time range presets' })
    .filter({ visible: true })
    .getByRole('button', { name: span, exact: true })
    .click();
}

/**
 * A preset in the time bar shown (#1116), to check whether it is picked: found even while a
 * phone's chip has the presets folded away.
 */
export function spanPreset(page: Page, span: string): Locator {
  return page
    .locator('.time-scale')
    .filter({ visible: true })
    .getByRole('button', { name: span, exact: true, includeHidden: true });
}

/** Wait until the sky view has drawn. */
export async function skyRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
}

/** The middle of the space the panels leave free, at `x` (by default the middle). */
/**
 * Where the globe's centre is on screen: the middle of the space the panels leave free, as the
 * page measures it (--free-top, --free-bottom, --free-left, #946).
 */
export async function globeCentre(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    // The page sets them on its root, the element that holds the panels.
    const root = document.querySelector('[style*="--free-bottom"]') ?? document.documentElement;
    const style = getComputedStyle(root);
    const px = (name: string): number => Number.parseFloat(style.getPropertyValue(name)) || 0;
    const [top, bottom, left] = [px('--free-top'), px('--free-bottom'), px('--free-left')];
    return {
      x: (left + window.innerWidth) / 2,
      y: (top + window.innerHeight - bottom) / 2,
    };
  });
}

export async function freeSpot(page: Page, x?: number): Promise<{ x: number; y: number }> {
  const top = (await page.locator('.hud').boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 };
  const bottom = (await page.locator('.bottom').boundingBox()) ?? { y: 0 };
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const narrow = viewport.width <= 600;
  const from = narrow ? top.y + top.height : 0;
  // On wide screens the date panel sits at the left, so aim between it and the right edge.
  const left = narrow ? 0 : top.x + top.width;
  return { x: x ?? (left + viewport.width) / 2, y: (from + bottom.y) / 2 };
}
