/** Temperature records side by side (#526): every record of global temperature since 1850. */

import { collectProblems, expect, globeRendered, test } from './support';

test('temperature records show side by side beside the globe, with the ozone hole’s panel under them @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const records = page.getByRole('region', { name: 'Temperature records side by side' });
  await test.step('Given 2016 with Warming since 1850 and the ozone hole on', async () => {
    await page.goto('./?t=2016-10-01T12:00Z&layers=warming,ozone&cam=-40,40,3');
    await globeRendered(page);
  });
  await test.step('Then six records are drawn, reanalyses dashed, the year marked and their range said', async () => {
    await expect(records.locator('.records-line')).toHaveCount(6);
    await expect(records.locator('.records-line.is-reanalysis')).toHaveCount(2);
    await expect(records.locator('.records-cursor')).toHaveCount(1);
    await expect(records).toContainText(/2016: \+\d\.\d\d to \+\d\.\d\d °C, 6 records\./);
    await expect(page.getByRole('region', { name: 'The ozone hole and the gases' })).toBeAttached();
  });
  await test.step('When they go to 1700, Then no record is marked', async () => {
    await page.locator('.hud-date-button').click();
    await page.getByRole('textbox', { name: 'A year or an age' }).fill('1700');
    await page.getByRole('button', { name: 'Go', exact: true }).click();
    await expect(records).toContainText('No record for 1700.');
    await expect(records.locator('.records-cursor')).toHaveCount(0);
  });
  expect(problems).toEqual([]);
});
