/** The Years bar's range (#749): fitted to a layer turned on, picked, and kept in the link. */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

test('turning on El Niño fits the Years bar to its years, and the range can be picked back @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const range = page.getByRole('combobox', { name: 'Years shown' });
  await test.step('Given today, the bar over the whole Holocene', async () => {
    await page.goto('./?t=2026-06-15T12:00Z&cam=0,-150,3');
    await globeRendered(page);
    await expect(range).toHaveValue('all');
  });
  await test.step('When they turn on El Niño and La Niña', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'El Niño and La Niña' }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then the bar shows its years, the year shown unmoved, and the link keeps them', async () => {
    await expect(range).toHaveValue('1854,2026');
    await expect(page).toHaveURL(/yw=1854,2026/);
    await expect(page).toHaveURL(/t=2026-06-15/);
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).toHaveAttribute(
      'min',
      '1854',
    );
  });
  await test.step('And the speeds are set by those years, the slowest a year a second (#915)', async () => {
    const speed = page.getByRole('navigation', { name: 'Year and eclipses' }).getByLabel('Speed');
    await expect(speed.locator('option')).toHaveText(['1 yr/s', '5 yr/s', '20 yr/s']);
  });
  await test.step('When they pick the whole Holocene again', async () => {
    await range.selectOption({ label: 'The Holocene, 9700 BCE–2026' });
  });
  await test.step('Then the bar spans it, and the link drops the range', async () => {
    await expect(page).not.toHaveURL(/yw=/);
    await expect(page.getByRole('slider', { name: 'Year in the Holocene' })).not.toHaveAttribute(
      'min',
      '1854',
    );
  });
  expect(problems).toEqual([]);
});
