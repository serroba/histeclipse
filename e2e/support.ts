/** Steps shared by the end-to-end features. */

import { expect, type Page } from '@playwright/test';

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
