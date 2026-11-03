/**
 * Feature: Humans in the ice ages. Dated finds of our species and of its relatives, each with
 * its source; where the evidence is argued over, the competing dates are given side by side.
 */

import { collectProblems, expect, globeRendered, showDeepDetails, test } from './support';

test('the Humans layer marks dated finds, and gives competing dates side by side', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const note = page.getByTestId('humans-note');
  await test.step('Given the ice ages 60,000 years ago', async () => {
    await page.goto('./?ma=0.06&scale=ice&cam=-15,135,3');
    await globeRendered(page);
    await showDeepDetails(page);
  });
  await test.step('When they turn on Humans', async () => {
    await page.getByRole('button', { name: 'Humans' }).click();
  });
  await test.step('Then the finds of that time are marked, with their dates', async () => {
    await expect(page).toHaveURL(/layers=[a-z,]*humans/);
    await expect(globe).toHaveAttribute('data-humans', /^[1-9]\d*$/);
    await expect(page.locator('.human-site', { hasText: 'Madjedbebe' })).toBeVisible();
  });
  await test.step('And the note gives both dates for reaching Australia, with sources', async () => {
    await expect(note).toContainText('When did people first reach Australia?');
    await expect(note).toContainText('Clarkson et al. 2017');
    await expect(note).toContainText('O’Connell et al. 2018');
  });
  await test.step('When they go back to 100,000 years ago', async () => {
    await page.goto('./?ma=0.1&scale=ice&layers=humans');
    await globeRendered(page);
  });
  await test.step('Then Australia is not yet marked, but the finds before are', async () => {
    await expect(page.locator('.human-site', { hasText: 'Madjedbebe' })).toHaveCount(0);
    await expect(page.locator('.human-site', { hasText: 'Misliya' })).toHaveCount(1);
  });
  expect(problems).toEqual([]);
});

test('Humans goes with deep time, and stays out of the link afterwards', async ({ page }) => {
  await page.goto('./?ma=0.06&scale=ice&layers=humans');
  await globeRendered(page);
  await page.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'Holocene' }).click();
  await expect(page).not.toHaveURL(/humans/);
  await expect(page.getByTestId('globe')).toHaveAttribute('data-humans', 'off');
});
