/** Ocean temperature (#590): the ocean's temperature at a depth each month since 1940, and deep each year (#940). */

import { collectProblems, expect, globeRendered, test } from './support';

test('the ocean’s temperature is painted at 100 m for the month, and at another depth picked @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'Ocean temperature' });
  await test.step('Given December 1997, the great El Niño, with Ocean temperature on', async () => {
    await page.goto('./?t=1997-12-15T12:00Z&layers=oceanTemp&cam=0,-140,3');
    await globeRendered(page);
  });
  await test.step('Then the month at 100 m is painted, with its scale', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ocean-temp', 'on');
    await expect(panel).toContainText('At 100 m, December 1997');
    await expect(panel).toContainText('−4 · 0 · +4 °C');
  });
  await test.step('When they pick 700 m, Then that depth, on its own scale, and how sparse it was', async () => {
    await panel.getByRole('combobox', { name: 'Depth' }).selectOption({ label: '700 m' });
    await expect(panel).toContainText('At 700 m, December 1997');
    await expect(panel).toContainText('−1 · 0 · +1 °C');
    await expect(panel).toContainText('Before the Argo floats (2005)');
  });
  await test.step('When they pick 4,000 m, Then the year’s deep map, said to be a reconstruction', async () => {
    await panel.getByRole('combobox', { name: 'Depth' }).selectOption({ label: '4,000 m, yearly' });
    await expect(panel).toContainText('At 4,000 m, the year 1997');
    await expect(panel).toContainText('−0.1 · 0 · +0.1 °C');
    await expect(panel).toContainText('a reconstruction more than a measurement');
  });
  expect(problems).toEqual([]);
});
