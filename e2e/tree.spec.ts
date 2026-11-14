/**
 * Feature: the tree of life (#300). One tree from the first cells to our species, in 3D, with
 * the fossil genera on the map hung on it. Opened from a find or Layers; a taxon's
 * line back to the root is lit and listed, each step a way to that group.
 */

import { collectProblems, expect, globeRendered, GPU, openLayers, test } from './support';

import treeFixture from './fixtures/tree-of-life.json' with { type: 'json' };

const NODES = /^[1-9]\d{3,}$/;
// Drawing eight thousand taxa beside the globe takes seconds on runners that render in software,
// and while it lays them out a tap's answer (the link changing) is as slow to come (#326).
const DRAWN = { timeout: 20_000 };

test(
  'from our species to the mammals, and the whole tree, then back to the globe @acceptance',
  GPU,
  async ({ page }) => {
    // PRs exercise the production sheet with a small real subtree. Nightly/default runs
    // retain the full-data journey, including its thousands-of-nodes assertion.
    const acceptance = process.env['E2E_SCOPE'] === 'acceptance';
    if (acceptance)
      await page.route('**/data/tree-of-life.json', (route) =>
        route.fulfill({ json: treeFixture }),
      );
    else test.slow();
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
      await expect(page).toHaveURL(/tree=ott770315/, DRAWN);
      await expect(page.getByTestId('tree-canvas')).toHaveAttribute(
        'data-nodes',
        acceptance ? String(treeFixture.parent.length) : NODES,
        DRAWN,
      );
      const focus = page.getByTestId('tree-focus');
      await expect(focus.getByRole('heading')).toHaveText('Homo sapiens');
      await expect(focus.getByRole('list')).toContainText('Primates');
      await expect(focus.getByRole('list')).toContainText('cellular organisms');
    });
    await test.step('When they follow the line to the mammals', async () => {
      await page.getByTestId('tree-focus').getByRole('button', { name: 'Mammalia' }).click();
    });
    await test.step('Then the tree lights the mammals instead', async () => {
      await expect(page).toHaveURL(/tree=ott244265/, DRAWN);
      await expect(page.getByTestId('tree-focus').getByRole('heading')).toHaveText('Mammalia');
    });
    await test.step('When they ask for the whole tree, then close it', async () => {
      await sheet.getByRole('button', { name: 'The whole tree' }).click();
      await expect(page).toHaveURL(/tree=all/, DRAWN);
      await expect(page.getByTestId('tree-focus').getByRole('heading')).toHaveCount(0);
      await sheet.getByRole('button', { name: 'Close' }).click();
    });
    await test.step('Then the globe is back, and the link no longer names the tree', async () => {
      await expect(sheet).toBeHidden();
      await expect(page).not.toHaveURL(/tree=/, DRAWN);
    });
    expect(problems).toEqual([]);
  },
);

test('a link opens the tree at a taxon, and its book says where the tree comes from', async ({
  page,
}) => {
  // The globe and then eight thousand taxa, drawn in software on CI's runners, as above.
  test.slow();
  const problems = collectProblems(page);
  await test.step('Given a link to the tree at Neanderthals', async () => {
    await page.goto('./?tree=ott83926');
    await globeRendered(page);
  });
  await test.step('Then the tree opens there, extinct, among our species', async () => {
    const focus = page.getByTestId('tree-focus');
    await expect(focus.getByRole('heading')).toHaveText('Homo sapiens neanderthalensis †', DRAWN);
    await expect(focus.getByRole('list')).toContainText('Homo sapiens');
  });
  await test.step('When they open its book', async () => {
    await page
      .getByRole('dialog', { name: /Tree of life/ })
      .getByRole('button', { name: 'Why: Tree of life' })
      .click();
  });
  await test.step('Then it names Open Tree of Life, its licence, and where groups are broken', async () => {
    // The tree may still be laying out, so the tap's answer can be slow to come (#326).
    await expect(page).toHaveURL(/why=tree/, DRAWN);
    const why = page.locator('.why-dialog');
    await expect(why).toContainText('Open Tree of Life');
    await expect(why).toContainText('CC0');
    await expect(why).toContainText('Tyrannosaurus');
  });
  expect(problems).toEqual([]);
});
