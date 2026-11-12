/**
 * Feature: life through time (#358). A fossil group's genera as a radial tree of time, from the
 * Paleobiology Database: the group starts at the centre, time runs outward, and the tree grows as
 * the playhead ring moves; the genera living then are dots on the ring and on the map of that
 * moment. Opened from Layers, a fossil's card or a link; a genus's line back to its group is lit
 * and listed, with a way to its fossils on the globe.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

const GENERA = /^[1-9]\d{3,}$/;
// Drawing thousands of lines beside the globe takes seconds on runners that render in software.
const DRAWN = { timeout: 20_000 };

// A one-pixel image, for Wikimedia's pictures: the suite does not reach out to Wikimedia.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('Layers opens the dinosaurs through time, which grow as the playhead moves', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const sheet = page.getByRole('dialog', { name: /Life through time/ });
  const canvas = page.getByTestId('lineages-canvas');
  await test.step('Given the end of the Cretaceous with Fossils on', async () => {
    await page.goto('./?ma=66&layers=fossils');
    await globeRendered(page);
  });
  await test.step('When they ask Layers for the genera through time', async () => {
    await openLayers(page);
    await page.getByRole('button', { name: 'Their tree through time' }).click();
  });
  await test.step('Then the dinosaurs are drawn, with their groups as a key', async () => {
    await expect(page).toHaveURL(/lineages=dinosaurs/);
    await expect(canvas).toHaveAttribute('data-genera', GENERA, DRAWN);
    await expect(sheet.getByRole('button', { name: 'Dinosaurs' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(sheet).toContainText('Tyrannosauroidea');
  });
  await test.step('When they move the playhead to 150 million years ago', async () => {
    await sheet.getByRole('button', { name: /Pause|Play/ }).click();
    await page.getByTestId('lineages-slider').fill('-150');
  });
  await test.step('Then the moment and the genera living then are named', async () => {
    await expect(canvas).toHaveAttribute('data-ma', '150.0');
    await expect(sheet).toContainText(/150 million years ago · [1-9]\d* genera living/);
  });
  await test.step('When they switch to the mammals', async () => {
    await sheet.getByRole('button', { name: 'Mammals' }).click();
  });
  await test.step('Then the mammals are drawn, and the link says so', async () => {
    await expect(page).toHaveURL(/lineages=mammals/);
    await expect(canvas).toHaveAttribute('data-group', 'mammals', DRAWN);
  });
  await test.step('When they close it', async () => {
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('Then the globe is back, and the link no longer names the lines', async () => {
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/lineages=/);
  });
  expect(problems).toEqual([]);
});

test('a link picks out Tyrannosaurus, its line back to Dinosauria, and leads to the globe', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const focus = page.getByTestId('lineages-focus');
  await test.step('Given a link to Tyrannosaurus through time', async () => {
    await page.goto('./?lineages=dinosaurs:38613');
    await globeRendered(page);
  });
  await test.step('Then it is picked out, with its span and its line back to the group', async () => {
    await expect(focus.getByRole('heading')).toHaveText('Tyrannosaurus', DRAWN);
    await expect(focus).toContainText('From 84 million years ago to 66');
    await expect(focus.getByRole('list')).toContainText('Dinosauria');
    await expect(focus.getByRole('list')).toContainText('Theropoda');
    // The playhead at its last appearance, so its whole line shows.
    await expect(page.getByTestId('lineages-canvas')).toHaveAttribute('data-ma', '66.0');
  });
  await test.step('When they follow its line to Tyrannosauridae', async () => {
    await focus.getByRole('button', { name: 'Tyrannosauridae' }).click();
  });
  await test.step('Then the family is picked out', async () => {
    await expect(focus.getByRole('heading')).toHaveText('Tyrannosauridae');
    await expect(focus).toContainText(/Family of \d+ genera here/);
    await expect(page).toHaveURL(/lineages=dinosaurs:\d+/);
  });
  await test.step('When they go to see its fossils on the globe', async () => {
    await focus.getByRole('button', { name: /See its fossils on the globe/ }).click();
  });
  await test.step('Then deep time opens at its start with Fossils on, the lines closed', async () => {
    await expect(page).toHaveURL(/ma=\d+/);
    await expect(page).toHaveURL(/layers=[a-z,]*fossils/);
    await expect(page).not.toHaveURL(/lineages=/);
  });
  expect(problems).toEqual([]);
});

test('a fossil’s card leads to its genus through time', async ({ page }) => {
  test.slow();
  const problems = collectProblems(page);
  const card = page.getByTestId('marker-card');
  await page.route(/^https:\/\/(upload|thumb)\.wikimedia\.org\//, (route) =>
    route.fulfill({ contentType: 'image/png', body: PIXEL }),
  );
  await test.step('Given a cell of fossils from the late Cretaceous, its card open', async () => {
    await page.goto('./?ma=68&layers=fossils');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-fossils', /^[1-9]\d*$/);
    await page.locator('.fossil-cell:visible').first().click();
    await expect(card).toBeVisible();
  });
  let genus = '';
  await test.step('When they ask for the genus found most, through time', async () => {
    const action = card.getByRole('button', { name: / on the tree through time$/ });
    genus = (await action.textContent())?.replace(' on the tree through time', '') ?? '';
    await action.click();
  });
  await test.step('Then its group opens through time, the genus picked out', async () => {
    await expect(page).toHaveURL(/lineages=[a-z]+/);
    await expect(page.getByTestId('lineages-canvas')).toHaveAttribute('data-genera', GENERA, DRAWN);
    // A genus named only for footprints or eggs is not drawn: the group opens without a pick.
    if (/lineages=[a-z]+:\d+/.test(page.url())) {
      await expect(page.getByTestId('lineages-focus').getByRole('heading')).toHaveText(genus);
    }
  });
  expect(problems).toEqual([]);
});

/** Move the pointer over `points` in turn until the tooltip shows; where it did, or null. */
async function pointUntilTip(
  page: Page,
  points: readonly (readonly [number, number])[],
): Promise<readonly [number, number] | null> {
  const tip = page.locator('.lineages-tip');
  for (const [x, y] of points) {
    await page.mouse.move(x, y);
    if (await tip.isVisible()) return [x, y];
  }
  return null;
}

test('pointing at a line on the fan or a dot on the map names its genus; a click picks it', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const focus = page.getByTestId('lineages-focus');
  const tip = page.locator('.lineages-tip');
  await test.step('Given the dinosaurs through time, Tyrannosaurus picked', async () => {
    await page.goto('./?lineages=dinosaurs:38613');
    await globeRendered(page);
    await expect(focus.getByRole('heading')).toHaveText('Tyrannosaurus', DRAWN);
  });
  let named = '';
  let onFan: readonly [number, number] | null = null;
  await test.step('When they point round the fan, Then a genus is named', async () => {
    const box = await page.getByTestId('lineages-canvas').boundingBox();
    if (box === null) throw new Error('The fan is not laid out');
    const points: (readonly [number, number])[] = [];
    for (let r = 0.1; r < 0.45; r += 0.02) {
      for (let a = 0; a < 2 * Math.PI; a += 0.05) {
        points.push([
          box.x + box.width / 2 + r * box.width * Math.cos(a),
          box.y + box.height / 2 + r * box.height * Math.sin(a),
        ]);
      }
    }
    onFan = await pointUntilTip(page, points);
    expect(onFan).not.toBeNull();
    named = (await tip.locator('strong').textContent()) ?? '';
  });
  await test.step('When they click there, Then that genus is picked', async () => {
    const [x, y] = onFan ?? [0, 0];
    await page.mouse.click(x, y);
    await expect(focus.getByRole('heading')).toHaveText(named);
  });
  await test.step('When they point across the map, Then a genus is named there too', async () => {
    const box = await page.getByTestId('lineages-map').boundingBox();
    if (box === null) throw new Error('The map is not laid out');
    const points: (readonly [number, number])[] = [];
    for (let y = 0.1; y < 0.9; y += 0.03) {
      for (let x = 0.02; x < 0.98; x += 0.015) {
        points.push([box.x + x * box.width, box.y + y * box.height]);
      }
    }
    expect(await pointUntilTip(page, points)).not.toBeNull();
  });
  expect(problems).toEqual([]);
});
