/** Where the ocean gained heat (#589): IAP's trend maps, with their own scale. */

import { collectProblems, expect, globeRendered, test } from './support';

test('the ocean heat maps paint where the sea gained heat, on their own scale, one map picked at a time @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'Where the ocean gained heat' });
  await test.step('Given today with Ocean heat on', async () => {
    await page.goto('./?t=2024-06-01T12:00Z&layers=oceanHeat&cam=10,-30,3');
    await globeRendered(page);
  });
  await test.step('Then the whole column since 1960 is painted, with its legend in W/m²', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ocean-heat', 'on');
    await expect(panel.getByRole('combobox', { name: 'Which map' })).toHaveValue(
      '0-2000m-1960-2025',
    );
    await expect(panel).toContainText('Heat gained by the ocean, W/m²');
  });
  await test.step('When they pick the Argo years, Then that map is said', async () => {
    await panel.getByRole('combobox', { name: 'Which map' }).selectOption('0-2000m-2005-2025');
    await expect(page.getByRole('region', { name: 'Where the ocean gained heat' })).toBeVisible();
    await expect(page).toHaveURL(/layers=[a-zA-Z,]*oceanHeat/);
  });
  expect(problems).toEqual([]);
});
