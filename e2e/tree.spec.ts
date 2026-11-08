/**
 * Feature: the tree of life (#300). One tree from the first cells to our species, in 3D, with
 * the fossil genera on the map hung on it. Opened from a find, a fossil or Layers; a taxon's
 * line back to the root is lit and listed, each step a way to that group.
 */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

const NODES = /^[1-9]\d{3,}$/;

// A one-pixel image, for Wikimedia's pictures: the suite does not reach out to Wikimedia.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64',
);

test('from our species to the mammals, and the whole tree, then back to the globe', async ({
  page,
}) => {
  // The globe and then eight thousand taxa, drawn in software on CI's runners.
  test.slow();
  const problems = collectProblems(page);
  const sheet = page.getByRole('dialog', { name: /Tree of life/ });
  await test.step('Given the ice ages with Humans on', async () => {
    await page.goto('./?ma=0.06&scale=ice&layers=humans');
    await globeRendered(page);
  });
  await test.step('When they ask Layers for our species on the tree of life', async () => {
    await openLayers(page);
    await page.getByRole('button', { name: 'Our species on the tree of life' }).click();
  });
  await test.step('Then the tree opens at Homo sapiens, living, its line back to the first cells', async () => {
    await expect(page).toHaveURL(/tree=ott770315/);
    await expect(page.getByTestId('tree-canvas')).toHaveAttribute('data-nodes', NODES);
    const focus = page.getByTestId('tree-focus');
    await expect(focus.getByRole('heading')).toHaveText('Homo sapiens');
    await expect(focus.getByRole('list')).toContainText('Primates');
    await expect(focus.getByRole('list')).toContainText('cellular organisms');
  });
  await test.step('When they follow the line to the mammals', async () => {
    await page.getByTestId('tree-focus').getByRole('button', { name: 'Mammalia' }).click();
  });
  await test.step('Then the tree lights the mammals instead', async () => {
    await expect(page).toHaveURL(/tree=ott244265/);
    await expect(page.getByTestId('tree-focus').getByRole('heading')).toHaveText('Mammalia');
  });
  await test.step('When they ask for the whole tree, then close it', async () => {
    await sheet.getByRole('button', { name: 'The whole tree' }).click();
    await expect(page).toHaveURL(/tree=all/);
    await expect(page.getByTestId('tree-focus').getByRole('heading')).toHaveCount(0);
    await sheet.getByRole('button', { name: 'Close' }).click();
  });
  await test.step('Then the globe is back, and the link no longer names the tree', async () => {
    await expect(sheet).toBeHidden();
    await expect(page).not.toHaveURL(/tree=/);
  });
  expect(problems).toEqual([]);
});

test('a fossil’s card leads to its genus on the tree of life', async ({ page }) => {
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
  await test.step('When they ask for the genus found most on the tree', async () => {
    const action = card.getByRole('button', { name: / on the tree of life$/ });
    genus = (await action.textContent())?.replace(' on the tree of life', '') ?? '';
    await action.click();
  });
  await test.step('Then the tree opens at that genus', async () => {
    await expect(page).toHaveURL(/tree=ott\d+/);
    await expect(page.getByTestId('tree-focus').getByRole('heading')).toContainText(genus);
    await expect(page.getByTestId('tree-canvas')).toHaveAttribute('data-nodes', NODES);
  });
  expect(problems).toEqual([]);
});

test('a link opens the tree at a taxon, and its book says where the tree comes from', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given a link to the tree at Neanderthals', async () => {
    await page.goto('./?tree=ott83926');
    await globeRendered(page);
  });
  await test.step('Then the tree opens there, extinct, among our species', async () => {
    const focus = page.getByTestId('tree-focus');
    await expect(focus.getByRole('heading')).toHaveText('Homo sapiens neanderthalensis †');
    await expect(focus.getByRole('list')).toContainText('Homo sapiens');
  });
  await test.step('When they open its book', async () => {
    await page
      .getByRole('dialog', { name: /Tree of life/ })
      .getByRole('button', { name: 'Why: Tree of life' })
      .click();
  });
  await test.step('Then it names Open Tree of Life, its licence, and where groups are broken', async () => {
    await expect(page).toHaveURL(/why=tree/);
    const why = page.locator('.why-dialog');
    await expect(why).toContainText('Open Tree of Life');
    await expect(why).toContainText('CC0');
    await expect(why).toContainText('Tyrannosaurus');
  });
  expect(problems).toEqual([]);
});
