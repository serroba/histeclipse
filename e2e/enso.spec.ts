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
  await test.step('When they fold the panel, Then it is one line with its name, and unfolds again', async () => {
    await panel.getByRole('button', { name: 'Fold El Niño and La Niña' }).click();
    await expect(panel.getByRole('list', { name: 'The indices' })).toBeHidden();
    await panel.getByRole('button', { name: 'Unfold El Niño and La Niña' }).click();
    await expect(panel.getByRole('list', { name: 'The indices' })).toBeVisible();
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

test('why here: in the equatorial Pacific, the sea that month and what El Niño and La Niña usually bring (#893)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const here = page.getByRole('dialog', { name: /^Here: / });
  await test.step('Given a link to the equatorial Pacific in December 1997, with El Niño and La Niña on', async () => {
    await page.goto('./?t=1997-12-15T12:00Z&loc=0,-120&layers=enso&cam=0,-120,3&why=here');
    await globeRendered(page);
  });
  await test.step('Then "Here" gives the sea that month, warm, and the usual signal by each index', async () => {
    await expect(here).toContainText(/The sea’s surface here in December 1997: \+\d\.\d °C/);
    await expect(here).toContainText(
      'What El Niño and La Niña have usually brought here in December–February',
    );
    await expect(here).toContainText(/El Niño by RONI, rain [^,]+, temperature \+\d\.\d\d °C/);
    await expect(here).toContainText('by ONI');
  });
  expect(problems).toEqual([]);
});

test('before 1950, El Niño and La Niña by two reconstructions, said to be ours, and the sea from ERSST (#894)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'El Niño and La Niña' });
  await test.step('Given December 1877, the great El Niño, with the layer on', async () => {
    await page.goto('./?t=1877-12-15T12:00Z&layers=enso&cam=0,-120,3');
    await globeRendered(page);
  });
  await test.step('Then both reconstructions are charted, and both call it El Niño', async () => {
    await expect(panel.getByRole('list', { name: 'The indices' }).getByRole('listitem')).toHaveText(
      ['Relative Niño 3.4 from ERSST v6 (ours)', 'Relative Niño 3.4 from HadISST (ours)'],
    );
    await expect(panel).toContainText('December 1877: El Niño by both indices');
    await expect(panel).toContainText('Before 1950 NOAA publishes no index');
  });
  await test.step('And the sea is painted from ERSST, on its 2° grid', async () => {
    await expect(page.getByTestId('globe')).toHaveAttribute('data-enso-sst', 'on');
    await expect(panel).toContainText('(NOAA ERSST v6, on its 2° grid)');
  });
  expect(problems).toEqual([]);
});
