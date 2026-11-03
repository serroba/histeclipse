/**
 * Feature: Fossils in deep time. Finds of four groups from the Paleobiology Database, counted
 * by 5 million years, where they lay at the time: on the continents of their own age.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the Fossils layer marks finds of the moment on the land of their time', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('fossils-note');
  await test.step('Given deep time 68 million years ago, in the late Cretaceous', async () => {
    await page.goto('./?ma=68');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Fossils', async () => {
    await page.getByRole('button', { name: 'Fossils' }).click();
  });
  await test.step('Then dinosaurs and others are marked, counted, with the source', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*fossils/);
    await expect(globe).toHaveAttribute('data-fossils', /^[1-9]\d*$/);
    await expect(page.locator('.fossil-cell.is-dinosaurs').first()).toBeAttached();
    await expect(note).toContainText('Fossils, 70–65 million years ago, where they lay then:');
    await expect(note).toContainText('Non-avian dinosaurs');
    await expect(note.getByRole('link', { name: 'the Paleobiology Database' })).toBeVisible();
  });
  await test.step('When they go to the Cambrian, trilobites take their place', async () => {
    await page.goto('./?ma=510&layers=fossils');
    await globeRendered(page);
    await expect(page.locator('.fossil-cell.is-trilobites').first()).toBeAttached();
    await expect(page.locator('.fossil-cell.is-dinosaurs')).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});
