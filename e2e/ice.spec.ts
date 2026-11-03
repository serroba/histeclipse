/**
 * Feature: Ice sheets in the ice ages. PaleoMIST's ice fills the last 80,000 years; Batchelor
 * et al.'s outlines of 18 time slices show where others put the ice, with their range.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the ice ages outline Batchelor et al.’s ice sheets, with their range', async ({ page }) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const outlines = page.getByTestId('ice-outlines');
  await test.step('Given the ice ages 150,000 years ago, in the penultimate glaciation', async () => {
    await page.goto('./?ma=0.15&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then the globe outlines MIS 6, and the bar says whose and how', async () => {
    await expect(globe).toHaveAttribute('data-ice-outlines', 'MIS 6');
    await expect(outlines).toHaveText(
      /^Outlines: Batchelor et al\. \(2019\), MIS 6 \(132,000–190,000 years ago\): their best estimate \(solid gold\), minimum \(dotted blue\) and maximum \(dashed red\)/,
    );
  });
  await test.step('When they go back to the Holocene', async () => {
    await page
      .getByRole('group', { name: 'Time' })
      .getByRole('button', { name: 'Holocene' })
      .click();
  });
  await test.step('Then the outlines go with deep time', async () => {
    await expect(globe).toHaveAttribute('data-ice-outlines', 'off');
  });
  expect(problems).toEqual([]);
});

test('between Batchelor et al.’s time slices, no outlines are drawn', async ({ page }) => {
  await test.step('Given the ice ages 120,000 years ago, between time slices', async () => {
    await page.goto('./?ma=0.12&scale=ice');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('Then no outlines are drawn, and none are described', async () => {
    await expect(page.getByTestId('ice-sheets')).toBeVisible();
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ice-outlines', 'off');
    await expect(page.getByTestId('ice-outlines')).toBeHidden();
  });
});
