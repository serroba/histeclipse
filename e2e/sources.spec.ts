/**
 * Feature: Why this? Everything on screen can say where it comes from: a book beside it opens
 * what it shows, its sources with their kind, links and licences, and how the site used them;
 * the Sources list names what is on screen now.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('the Sources list names what is on screen now, and each book opens why', async ({ page }) => {
  const problems = collectProblems(page);
  const list = page.getByTestId('sources-list');
  const sheet = page.getByRole('dialog', { name: 'Ways of life' });
  await test.step('Given 500 BCE with states and ways of life on', async () => {
    await page.goto('./?t=-499-06-01T12:00&layers=lunar,solar,empires,ways');
    await globeRendered(page);
  });
  await test.step('When they open Sources', async () => {
    await openSources(page);
  });
  await test.step('Then it lists the ground, the sky’s bodies and each layer drawn', async () => {
    await expect(list.locator('.why-row-title')).toHaveText([
      'Earth today',
      'Sun, Moon and planets',
      'States and empires (Cliopatria)',
      'Ways of life',
    ]);
  });
  await test.step('When they ask why the ways of life are there', async () => {
    await list.getByRole('button', { name: 'Why: Ways of life' }).click();
  });
  await test.step('Then the panel says what it shows, its source and licence, and how it was used', async () => {
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('How people lived in each region');
    const link = sheet.getByRole('link', { name: 'ArchaeoGLOBE' });
    await expect(link).toHaveAttribute('href', 'https://doi.org/10.1126/science.aax1192');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(sheet.locator('.why-licence')).toHaveText('CC0 1.0');
    await expect(sheet).toContainText('How this site used it');
  });
  await test.step('When they ask for all the sources', async () => {
    await sheet.getByRole('button', { name: 'All sources the site uses' }).click();
  });
  await test.step('Then every source is listed by kind', async () => {
    const all = page.getByRole('dialog', { name: 'All sources' });
    await expect(all.getByRole('heading', { name: 'Papers' })).toBeVisible();
    await expect(all.getByRole('heading', { name: 'Datasets' })).toBeVisible();
    await expect(all.locator('.why-source')).not.toHaveCount(0);
    expect(await all.locator('.why-source').count()).toBeGreaterThan(30);
  });
  expect(problems).toEqual([]);
});

test('every layer in the panel has its book, and non-commercial terms are flagged', async ({
  page,
}) => {
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given the Layers panel open', async () => {
    await page.goto('./?t=1815-04-10T12:00');
    await globeRendered(page);
    await openLayers(page);
  });
  await test.step('Then each layer row has a book', async () => {
    const rows = await panel.locator('.layer-item').count();
    await expect(panel.locator('.layer-item .why-mark')).toHaveCount(rows);
  });
  await test.step('When they ask why the volcanic eruptions are there', async () => {
    await panel.getByRole('button', { name: 'Why: Volcanic eruptions' }).click();
  });
  await test.step('Then the source’s non-commercial terms stand out', async () => {
    const sheet = page.getByRole('dialog', { name: 'Volcanic eruptions' });
    await expect(sheet.getByRole('link', { name: 'Global Volcanism Program' })).toBeVisible();
    await expect(sheet.locator('.why-licence.is-nc')).toHaveText('Non-commercial use with credit');
  });
});

test('in deep time, the Sources list follows the span and the layers drawn there', async ({
  page,
}) => {
  const list = page.getByTestId('sources-list');
  await test.step('Given 250 million years ago with temperature on, and states left on', async () => {
    await page.goto('./?ma=250&scale=all&layers=temperature,empires');
    await globeRendered(page);
    await openSources(page);
  });
  await test.step('Then it names the Earth then and the temperature, not the resting states', async () => {
    await expect(list.locator('.why-row-title')).toHaveText(['The Earth then', 'Temperature']);
    await expect(list.getByRole('link', { name: 'PALEOMAP PaleoDEMs' })).toBeVisible();
  });
});
