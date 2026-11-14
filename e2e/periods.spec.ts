/**
 * Feature: Named periods. The archaeological and historical periods named for the place picked
 * in the year shown, from PeriodO, each with the source that defines it.
 */

import { collectProblems, expect, globeRendered, openLayers, openSources, test } from './support';

test('named periods list the periods for the place picked, each by its source @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const note = page.getByTestId('layer-note-periods');
  await test.step('Given a place picked in Greece in 2000 BCE', async () => {
    await page.goto('./?t=-1999-06-01T12:00&loc=38,23');
    await globeRendered(page);
  });
  await test.step('When they turn on Named periods', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Named periods' }).check();
  });
  await test.step('Then the note names periods for Greece then, with their sources', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*periods/);
    await expect(note).toHaveText(
      /^Periods named for Greece in 2000 BCE, each by its source: .+ \(.+\)/,
    );
    await openSources(page);
    await expect(page.getByRole('link', { name: 'PeriodO' })).toBeVisible();
  });
  await test.step('When they pick a place at sea, it asks for land', async () => {
    await page.goto('./?t=-1999-06-01T12:00&loc=0,-30&layers=lunar,solar,periods');
    await globeRendered(page);
    await openLayers(page);
    await expect(note).toHaveText('Pick a place on land to see the periods named there.');
  });
  expect(problems).toEqual([]);
});
