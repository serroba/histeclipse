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

test('when the AMOC records do not load, they are not fetched again as the years go by, its chip says so, and Try again draws them (#762) @mobile', async ({
  page,
}) => {
  const panel = page.getByRole('region', { name: 'The Atlantic overturning (AMOC)' });
  let fail = true;
  let asked = 0;
  await page.route('**/data/amoc/index.json', (route) => {
    asked += 1;
    return fail ? route.fulfill({ status: 503, body: 'down' }) : route.fallback();
  });
  await test.step('Given 2010 with the AMOC on, and its records unreachable', async () => {
    await page.goto('./?t=2010-06-15T12:00Z&layers=amoc&cam=25,-45,3');
    await globeRendered(page);
  });
  // One load asks twice: once, and once more past the browser's copy on a 5xx (`retryingFetch`).
  await expect.poll(() => asked).toBe(2);
  await test.step('When they step on through the years, Then the records are not asked for again', async () => {
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/t=2015-/);
    expect(asked).toBe(2);
  });
  const phone = (page.viewportSize()?.width ?? 1000) < 600;
  if (phone) await page.getByRole('button', { name: 'Layers' }).click();
  const chip = page.getByRole('group', { name: 'Layers on' }).locator('[data-layer="amoc"]');
  await test.step('Then its chip says it could not load', async () => {
    await expect(chip).toHaveAttribute('data-coverage', 'failed');
    await expect(chip).toContainText('could not load');
  });
  await test.step('When the records are back and they try again, Then the AMOC is drawn', async () => {
    fail = false;
    await chip.getByRole('button', { name: /try again/ }).click();
    await expect(chip).toHaveAttribute('data-coverage', 'available');
    if (phone) await page.keyboard.press('Escape');
    await expect(panel.locator('.amoc-row')).toHaveCount(6);
  });
});
