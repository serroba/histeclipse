/** The Atlantic overturning (#925): measured since 2004, beside reconstructions that disagree. */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

test('the AMOC shows each source on its own scale, the dispute said, and the array’s line @acceptance @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const panel = page.getByRole('region', { name: 'The Atlantic overturning (AMOC)' });
  await test.step('Given 2010, when they turn on the AMOC', async () => {
    await page.goto('./?t=2010-06-15T12:00Z&cam=25,-45,3');
    await globeRendered(page);
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'Atlantic overturning (AMOC)' }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then a row a source with its value for 2010, the dispute, and RAPID’s line', async () => {
    await expect(panel.locator('.amoc-row')).toHaveCount(6);
    await expect(panel.locator('.amoc-row.is-rapid .amoc-row-value')).toHaveText(/^\d+\.\d Sv$/);
    await panel.getByText('Has it weakened? The sources disagree').click();
    await expect(panel).toContainText('Whether the AMOC has already weakened is disputed');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-amoc-line', 'on');
    await expect(page).toHaveURL(/yw=400,2024/);
  });
  expect(problems).toEqual([]);
});
