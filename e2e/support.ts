/** Steps shared by the end-to-end features, and the test they run in. */

import { expect, test as base, type Page } from '@playwright/test';

export { expect };

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
    if (refreshRate !== null) {
      await page.addInitScript((hz) => {
        let time = performance.now();
        window.requestAnimationFrame = (callback) =>
          window.setTimeout(() => {
            time += 1000 / hz;
            callback(time);
          }, 1000 / hz);
      }, refreshRate);
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
