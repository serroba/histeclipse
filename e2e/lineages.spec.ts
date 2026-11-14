/**
 * Feature: life through time (#358). A fossil group's genera as a radial tree of time, from the
 * Paleobiology Database: the group starts at the centre, time runs outward, and the tree grows as
 * the playhead ring moves; the genera living then are dots on the ring and on the map of that
 * moment. Opened from Layers, a fossil's card or a link; a genus's line back to its group is lit
 * and listed, with a way to its fossils on the globe.
 */

import { colourGroups, fanLayout, isGenus, parseLineages, sitesAt } from '../src/data/lineages';
import { fanFrame } from '../src/features/treeOfLife/fanPicking';
import { PALETTE, rOf } from '../src/features/treeOfLife/lineagesTree';

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

test('a known genus can be pointed to and picked on the fan and found on the map @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await page.goto('./?lineages=dinosaurs:38613');
  await globeRendered(page);
  const focus = page.getByTestId('lineages-focus');
  await expect(focus.getByRole('heading')).toHaveText('Tyrannosaurus', DRAWN);
  const raw: unknown = await (await page.request.get('./data/time-tree/dinosaurs.json')).json();
  const lineages = parseLineages(raw);
  const { colour } = colourGroups(lineages, PALETTE.length);
  const fan = fanLayout(lineages, colour);
  const genus = fan.round
    .map((index) => lineages.nodes[index])
    .find(
      (node) => node !== undefined && node.pbdb !== 38613 && node.first >= 66 && node.last <= 66,
    );
  if (genus === undefined) throw new Error('No living genus to point to');
  const range = {
    oldest: lineages.nodes[0]?.first ?? 0,
    youngest: Math.min(...lineages.nodes.filter(isGenus).map((node) => node.last)),
  };
  const canvas = page.getByTestId('lineages-canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('No fan');
  const size = await canvas.evaluate((node) => ({
    width: node.clientWidth,
    height: node.clientHeight,
  }));
  const frame = fanFrame(size.width, size.height, { zoom: 1, panX: 0, panY: 0 });
  const angle = fan.angle[genus.index] ?? 0;
  const radius = rOf(range, (genus.first + genus.last) / 2) * frame.scale;
  const x = box.x + frame.cx + radius * Math.cos(angle);
  const y = box.y + frame.cy + radius * Math.sin(angle);
  await page.mouse.move(x, y);
  await expect(page.locator('.lineages-tip strong')).toHaveText(genus.name);
  await page.mouse.click(x, y);
  await expect(focus.getByRole('heading')).toHaveText(genus.name);
  const site = sitesAt(genus.track, 66, lineages.stepMa).sites[0];
  const map = await page.getByTestId('lineages-map').boundingBox();
  if (site === undefined || map === null) throw new Error('No mapped site');
  await page.mouse.move(
    map.x + ((site.longitude + 180) / 360) * map.width,
    map.y + ((90 - site.latitude) / 180) * map.height,
  );
  await expect(page.locator('.lineages-tip')).toBeVisible();
  expect(problems).toEqual([]);
});
