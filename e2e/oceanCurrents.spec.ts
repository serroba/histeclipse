/** Ocean currents (#927): the month's currents near the surface and at 1,500 m, as moving streaks. */

import { collectProblems, expect, globeRendered, test } from './support';

test('the ocean’s currents move near the surface for the month, and at 1,500 m when picked @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'Ocean currents' });
  await test.step('Given January 2010 over the Atlantic, with Ocean currents on', async () => {
    await page.goto('./?t=2010-01-15T12:00Z&layers=oceanCurrents&cam=30,-50,2.6');
    await globeRendered(page);
  });
  await test.step('Then the currents near the surface stream for the month', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ocean-currents', 'on');
    await expect(panel).toContainText('The currents near the surface, January 2010');
    await expect(panel).toContainText('to 1 m/s and beyond');
  });
  await test.step('When they pick 1,500 m, Then the deep currents, on their own scale', async () => {
    await panel.getByRole('combobox', { name: 'Depth' }).selectOption({ label: 'at 1,500 m' });
    await expect(panel).toContainText('The currents at 1,500 m, January 2010');
    await expect(panel).toContainText('to 0.2 m/s and beyond');
  });
  expect(problems).toEqual([]);
});

test('after IAP’s last year, the ocean’s currents show the same month of 2021, said so @acceptance', async ({
  page,
}) => {
  const problems = collectProblems(page);
  await test.step('Given January 2024, after IAP’s currents end, with Ocean currents on', async () => {
    await page.goto('./?t=2024-01-15T12:00Z&layers=oceanCurrents&cam=30,-50,2.6');
    await globeRendered(page);
  });
  await test.step('Then January 2021 streams, said so', async () => {
    await expect(page.getByRole('region', { name: 'Ocean currents' })).toContainText(
      'showing January 2021',
    );
  });
  expect(problems).toEqual([]);
});
