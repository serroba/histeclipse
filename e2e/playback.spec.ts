/**
 * Feature: Playing deep time on a slow connection. The maps of each moment take time to load;
 * as the years play by, the globe shows each one as it arrives, and loads the next ones ahead.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('on a slow connection, the globe keeps changing as deep time plays', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given deep time 300 million years ago, on a slow connection', async () => {
    await page.goto('./?ma=300');
    await globeRendered(page);
    // Each map takes longer to arrive than playing spends on it.
    await page.route('**/data/paleodem/*.png', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.continue();
    });
  });
  await test.step('When they play towards today', async () => {
    await deep.getByRole('button', { name: 'Play', exact: true }).click();
  });
  await test.step('Then, while it plays, the globe shows map after map', async () => {
    const shown = new Set<string>();
    await expect
      .poll(
        async () => {
          shown.add((await globe.getAttribute('data-deep-time')) ?? '');
          return shown.size;
        },
        { timeout: 10_000, intervals: [200] },
      )
      .toBeGreaterThan(3);
    await expect(deep.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await deep.getByRole('button', { name: 'Pause', exact: true }).click();
  });
  expect(problems).toEqual([]);
});
