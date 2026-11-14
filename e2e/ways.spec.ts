/**
 * Feature: Ways of life. How people lived by region over the last 10,000 years, as the
 * archaeologists of ArchaeoGLOBE rated it: foraging, herding, farming, towns.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('ways of life shade each region by how people lived, at the moment rated nearest @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('layer-note-ways');
  await test.step('Given 3500 BCE', async () => {
    await page.goto('./?t=-3499-06-01T12:00');
    await globeRendered(page);
  });
  await test.step('When they turn on Ways of life', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Ways of life' }).check();
  });
  await test.step('Then the regions are shaded, and the note says which moment and what is most widespread', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*ways/);
    await expect(globe).toHaveAttribute('data-ways', /^[1-9]\d*$/);
    await expect(note).toHaveText(
      /^As rated for 4051 BCE, the nearest moment ArchaeoGLOBE rates; the most widespread way of life, by region: foraging \d+/,
    );
    await openSources(page);
    await expect(page.getByRole('link', { name: 'ArchaeoGLOBE' })).toBeVisible();
  });
  await test.step('When they go to 1840, farming has spread', async () => {
    await page.goto('./?t=1840-06-01T12:00&layers=lunar,solar,ways');
    await globeRendered(page);
    await openLayers(page);
    await expect(note).toHaveText(/^As rated for 1850 CE.*farming \d+/);
  });
  expect(problems).toEqual([]);
});
