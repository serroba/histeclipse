/**
 * Feature: Geological time along the slider. The chart's units (periods, eras, the ice ages'
 * divisions) sit under the deep-time slider in the chart's colours; a tap goes to one.
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('the slider names the periods in the chart’s colours, and a tap goes to one', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bands = page.getByRole('group', { name: 'Geological periods' });
  await test.step('Given deep time 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
  });
  await test.step('Then the periods line the slider, the Triassic marked as now', async () => {
    await expect(bands.getByRole('button', { name: /^Jurassic, / })).toBeVisible();
    await expect(bands.locator('[aria-current="true"]')).toHaveAccessibleName(
      'Triassic, 251.9 million years ago to 201.4 million years ago',
    );
  });
  await test.step('When they tap the Jurassic', async () => {
    await bands.getByRole('button', { name: /^Jurassic, / }).click();
  });
  await test.step('Then deep time goes to its start', async () => {
    await expect(page).toHaveURL(/&ma=201\.4(&|$)/);
    await expect(page.getByTestId('deep-period')).toHaveText('Jurassic · Mesozoic');
  });
  await test.step('And on the ice-age scale, the Pleistocene’s ages line it instead', async () => {
    await page.getByRole('button', { name: 'Ice ages' }).click();
    await expect(bands.getByRole('button', { name: /^Chibanian, / })).toBeVisible();
    await expect(bands.getByRole('button', { name: /^Holocene, / })).toBeAttached();
  });
  expect(problems).toEqual([]);
});
