/**
 * Feature: Volcanic eruptions. Eruptions dated near the year shown, from the Smithsonian's
 * Global Volcanism Program, sized by explosivity; each opens a card with its photo, summary,
 * eruptions and a link to its page.
 */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

// A one-pixel image, for the GVP's photos: the suite does not reach out to the Smithsonian.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('the eruptions of 1815 include Tambora, and a volcano opens its card', async ({ page }) => {
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  await page.route('https://volcano.si.edu/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given April 1815', async () => {
    await page.goto('./?t=1815-04-10T12:00');
    await globeRendered(page);
  });
  await test.step('When they turn on Volcanic eruptions in Layers', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Volcanic eruptions' }).check();
  });
  await test.step('Then the eruptions near 1815 are marked, Tambora the largest', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*volcanoes/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-volcanoes', /^[1-9]\d*$/);
    await expect(page.getByTestId('layer-note-volcanoes')).toContainText(
      'within 25 years of 1815 CE',
    );
    await expect(page.getByTestId('layer-note-volcanoes')).toContainText(
      'The largest: Tambora, VEI 7.',
    );
  });
  await test.step('When they tap a volcano', async () => {
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.locator('.volcano-mark:visible').first().click();
  });
  await test.step('Then its card lists its eruptions, its summary and its page', async () => {
    await expect(card).toBeVisible();
    await expect(card).toContainText('Eruption');
    await expect(card.locator('.marker-card-note')).not.toHaveText('Loading its summary…');
    await expect(card.getByRole('link', { name: 'Global Volcanism Program' })).toHaveAttribute(
      'href',
      /^https:\/\/volcano\.si\.edu\/volcano\.cfm\?vn=\d+$/,
    );
  });
  expect(problems).toEqual([]);
});

test('in deep time there are no eruptions to show', async ({ page }) => {
  await page.goto('./?ma=66&layers=volcanoes');
  await globeRendered(page);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-volcanoes', 'off');
});
