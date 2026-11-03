/**
 * Feature: Ancient genomes. Dated ancient DNA from the Allen Ancient DNA Resource (Reich lab),
 * counted by region around the year shown; the lab's labels are given as its labels.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('ancient genomes are counted by region around the year shown, with the source', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  await test.step('Given the globe in 2500 BCE, looking at Europe', async () => {
    await page.goto('./?t=-2499-06-01T12:00&cam=48,15,3');
    await globeRendered(page);
  });
  await test.step('When they turn on Ancient genomes', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Ancient genomes' }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then regions with genomes dated near then are marked with their counts', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*genomes/);
    await expect(globe).toHaveAttribute('data-genomes', /^[1-9]\d*$/);
    await expect(page.locator('.genome-cell').first()).toHaveText(/^\d+$/);
    await openSources(page);
    await expect(page.getByRole('link', { name: 'Allen Ancient DNA Resource' })).toBeVisible();
  });
  await test.step('And the Layers panel says what is counted', async () => {
    await openLayers(page);
    await expect(page.getByTestId('layer-note-genomes')).toHaveText(
      /^\d[\d,]* genomes dated 2750–2250 BCE, in \d+ regions: where genomes have been sequenced, not how many people lived\. Labels are the lab’s, not peoples\.$/,
    );
  });
  expect(problems).toEqual([]);
});
