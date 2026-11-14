import { installVirtualDisplay } from './virtualDisplay';
/** Steps shared by the end-to-end features, and the test they run in. */

import { expect, test as base, type Page } from '@playwright/test';

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
  page.on('requestfailed', (request) => problems.push(`request failed: ${request.url()}`));
  page.on('response', (response) => {
    if (response.status() >= 400) {
      problems.push(`HTTP ${String(response.status())}: ${response.url()}`);
    }
  });
  return problems;
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
  const button = page.getByRole('button', { name: 'Layers' });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(page.getByRole('dialog', { name: 'Layers' })).toBeVisible();
}

/** Open the deep-time bar's details (folded on phones), unless they are open already. */
export async function showDeepDetails(page: Page): Promise<void> {
  const handle = page.getByRole('navigation', { name: 'Deep time' }).locator('.deep-handle');
  await expect(handle).toBeVisible();
  if ((await handle.getAttribute('aria-expanded')) !== 'true') await handle.click();
  await expect(page.getByTestId('deep-details')).toBeVisible();
}

/** Pick how far back time reaches, in the switch at the top: Years, Ice ages, 540 Myr, 4.6 Gyr. */
export async function pickSpan(page: Page, span: string): Promise<void> {
  await page
    .getByRole('group', { name: 'Time span' })
    .getByRole('button', { name: span, exact: true })
    .click();
}

/** Wait until the sky view has drawn. */
export async function skyRendered(page: Page): Promise<void> {
  await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
}

/** The middle of the space the panels leave free, at `x` (by default the middle). */
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
