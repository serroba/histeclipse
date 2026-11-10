/** Search by meaning: the model in the reader's browser, served from this site alone (#393). */

import { collectProblems, expect, globeRendered, test } from './support';

test('a reader asks a question in their own words and finds the record it means', async ({
  page,
  baseURL,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const elsewhere: string[] = [];
  page.on('request', (request) => {
    const host = new URL(request.url()).host;
    if (
      baseURL !== undefined &&
      host !== new URL(baseURL).host &&
      !request.url().startsWith('data:')
    ) {
      elsewhere.push(request.url());
    }
  });
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they turn on search by meaning and ask, in words no passage uses', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('checkbox', { name: /Search by meaning too/ }).check();
    await dialog.getByRole('searchbox').fill('a moon with an ocean hidden under its ice');
  });
  await test.step('Then the icy moons with oceans are found by meaning', async () => {
    await expect(dialog.getByRole('status')).toContainText('by words and meaning', {
      timeout: 60_000,
    });
    const top = dialog.locator('.search-results > li').first();
    await expect(top).toHaveAttribute(
      'data-passage',
      /^moon:(europa|enceladus|ganymede|dione|titan)$/,
    );
  });
  await test.step('When they ask about a battle stopped by an eclipse', async () => {
    await dialog.getByRole('searchbox').fill('the day turned to night during a battle in Lydia');
  });
  await test.step('Then Thales’s eclipse is among the first three', async () => {
    await expect(dialog.locator('.search-results > li').nth(0)).toBeVisible();
    await expect
      .poll(() =>
        dialog
          .locator('.search-results > li')
          .evaluateAll((items) =>
            items.slice(0, 3).map((item) => item.getAttribute('data-passage')),
          ),
      )
      .toContain('eclipse:thales-585-bce');
  });
  // And nothing was asked of another site: not the model, not its runtime.
  expect(elsewhere).toEqual([]);
  expect(problems).toEqual([]);
});
