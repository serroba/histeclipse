/**
 * Feature: Playing deep time on a slow connection. The maps of each moment take time to load;
 * as the years play by, the globe shows each one as it arrives, and loads the next ones ahead.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test, pickSpan } from './support';

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

test('deep time plays at a pace, its speed following the part of time shown (#1076)', async ({
  page,
}) => {
  // Plays for some seconds on purpose: slow machines need the room.
  test.setTimeout(60_000);
  const problems = collectProblems(page);
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  const pace = deep.getByLabel('Pace');
  const rate = deep.getByTestId('deep-rate');
  await test.step('Given deep time, 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
  });
  await test.step('Then it plays at Normal, the 540 million years in about 20 seconds', async () => {
    await expect(pace).toHaveValue('normal');
    await expect(pace.locator('option')).toHaveText(['Slow', 'Normal', 'Fast']);
    await expect(rate).toHaveText('≈ 20 Myr/s');
  });
  await test.step('When they pick Fast and play, it sweeps towards today', async () => {
    await pace.selectOption('fast');
    await expect(rate).toHaveText('≈ 100 Myr/s');
    await deep.getByRole('button', { name: 'Play', exact: true }).click();
    // Browser assurance is that the selected control advances the mounted scene. Exact pace
    // is tested with explicit frame timestamps; software rendering can deliver very few frames.
    const ma = () => Number(/[?&]ma=([\d.]+)/.exec(page.url())?.[1]);
    await expect.poll(ma, { timeout: 15_000 }).toBeLessThan(250);
    await deep.getByRole('button', { name: 'Pause', exact: true }).click();
  });
  await test.step('When they turn to the ice ages, the pace is kept, the speed thousands of years', async () => {
    await pickSpan(page, 'Ice ages');
    await expect(pace).toHaveValue('fast');
    await expect(rate).toHaveText('≈ 500 kyr/s');
  });
  await test.step('When they zoom in, the same pace plays slower', async () => {
    await deep.getByRole('button', { name: 'Show less time' }).click();
    await expect(rate).toHaveText('≈ 200 kyr/s');
  });
  expect(problems).toEqual([]);
});

test('deep time slows near milestones as it plays, unless turned off or less motion is asked for (#1077)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const easing = page.getByTestId('deep-easing');
  await test.step('Given deep time, Then playing slows near milestones and finds', async () => {
    await page.goto('./?ma=100');
    await globeRendered(page);
    await expect(easing).toBeChecked();
  });
  await test.step('When they turn it off, Then it stays off as they play', async () => {
    await showDeepDetails(page);
    // With the milestones, in their fold.
    await page.getByTestId('deep-milestones').locator('summary').click();
    await easing.uncheck();
    await expect(easing).not.toBeChecked();
  });
  await test.step('Given a reader who asks for less motion, Then it starts off', async () => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./?ma=100');
    await globeRendered(page);
    await expect(easing).not.toBeChecked();
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
