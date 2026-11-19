/**
 * El Niño and La Niña (#886): NOAA's two indices side by side, where they disagree, and the sea;
 * and what El Niño usually does to rain, by either index (#891, #892).
 */

import { collectProblems, expect, globeRendered, test } from './support';

test('the El Niño indices are charted side by side, and a month where they disagree is said @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'El Niño and La Niña' });
  await test.step('Given January 2025 with El Niño and La Niña on', async () => {
    await page.goto('./?t=2025-01-15T12:00Z&layers=enso&cam=10,-150,3');
    await globeRendered(page);
  });
  await test.step('Then both indices are charted, each with its own strip of episodes', async () => {
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('list', { name: 'The indices' }).getByRole('listitem')).toHaveText(
      ['Relative Oceanic Niño Index (RONI)', 'Oceanic Niño Index (ONI)'],
    );
  });
  await test.step('And the month’s sea surface temperature is painted, with its scale', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-enso-sst', 'on');
    await expect(panel).toContainText('blue colder, red warmer, to ±4 °C');
  });
  await test.step('And the month is said with each index’s call, since they disagree', async () => {
    await expect(panel).toContainText('January 2025: the indices disagree. RONI: La Niña');
    await expect(panel).toContainText('ONI: neither');
  });
  await test.step('When they pick El Niño’s rain in December–February, by ONI, Then it is painted on its own scale, its seasons said', async () => {
    await panel
      .getByRole('combobox', { name: 'On the globe' })
      .selectOption({ label: 'Rain, El Niño, December–February' });
    await panel.getByRole('combobox', { name: 'By which index' }).selectOption({ label: 'by ONI' });
    await expect(panel).toContainText(
      /On the globe: Rain in El Niño’s December–February, by ONI: the mean of \d+ seasons/,
    );
    await expect(panel).toContainText('mm a day');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-enso-sst', 'on');
  });
  expect(problems).toEqual([]);
});
