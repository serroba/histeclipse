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

test('deep time has speeds in the units of its span, and plays at the one picked', async ({
  page,
}) => {
  // Plays for some seconds on purpose: slow machines need the room.
  test.setTimeout(60_000);
  const problems = collectProblems(page);
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  const speed = deep.getByLabel('Speed');
  await test.step('Given deep time, 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
  });
  await test.step('Then the 540-million-year span offers millions of years a second', async () => {
    await expect(speed).toHaveValue('20');
    await expect(speed.locator('option')).toHaveText(['5 Myr/s', '20 Myr/s', '50 Myr/s']);
  });
  await test.step('When they pick 50 Myr/s and play, it sweeps towards today', async () => {
    await speed.selectOption('50');
    await deep.getByRole('button', { name: 'Play', exact: true }).click();
    // At 50 Myr a second, well past 150 million years ago within a few seconds.
    const ma = () => Number(/[?&]ma=([\d.]+)/.exec(page.url())?.[1]);
    await expect.poll(ma, { timeout: 15_000 }).toBeLessThan(150);
    await deep.getByRole('button', { name: 'Pause', exact: true }).click();
  });
  await test.step('When they turn to the ice ages, the speeds are thousands of years', async () => {
    await page.getByRole('button', { name: 'Ice ages' }).click();
    await expect(speed.locator('option')).toHaveText([
      '10,000 years/s',
      '50,000 years/s',
      '200,000 years/s',
    ]);
    await expect(speed).toHaveValue('0.05');
  });
  expect(problems).toEqual([]);
});

test('an eclipse plays at the minutes a second picked', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given the eclipse of Thales, and 60 minutes a second picked', async () => {
    await page.goto('./?t=-584-05-28T12:00&sel=solar:-0584-05-28');
    await globeRendered(page);
    await expect(page.locator('.scrubber').getByLabel('Speed')).toHaveValue('12');
    await page.locator('.scrubber').getByLabel('Speed').selectOption('60');
  });
  await test.step('When they play it, it reaches greatest eclipse', async () => {
    await page.locator('.scrubber').getByRole('button', { name: 'Play' }).click();
    await expect(page.locator('.scrubber-time')).toContainText(/\(\+?\d+ min\)|greatest/, {
      timeout: 15_000,
    });
  });
  expect(problems).toEqual([]);
});
