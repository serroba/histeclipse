/** Search: the site's texts found by their words, each opening the view of its place (#392). */

import { collectProblems, expect, globeRendered, test } from './support';

test('a reader searches for a record by its place and opens it', async ({ page }) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they open search and type a city’s name', async () => {
    await page.getByRole('button', { name: 'Search the texts' }).click();
    await dialog.getByRole('searchbox').fill('Ugarit');
  });
  await test.step('Then its eclipse record comes first, with where and when it is', async () => {
    const first = dialog.locator('.search-hit').first();
    await expect(first).toContainText('The Ugarit eclipse');
    await expect(first).toContainText('35.6°N 35.8°E · 1223 BCE');
  });
  await test.step('When they open it', async () => {
    await dialog.locator('.search-hit').first().click();
  });
  await test.step('Then the eclipse is picked, seen from Ugarit', async () => {
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/sel=solar:-1222-03-05/);
    await expect(page).toHaveURL(/loc=35\.6017,35\.7822/);
  });
  expect(problems).toEqual([]);
});

test('a reader searches with the keyboard for a landing and flies to the Moon', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const dialog = page.getByRole('dialog', { name: 'Search' });
  await test.step('Given the globe today', async () => {
    await page.goto('./?cam=0,0,3');
    await globeRendered(page);
  });
  await test.step('When they press / and type a mission, still typing', async () => {
    await page.keyboard.press('/');
    await expect(dialog.getByRole('searchbox')).toBeFocused();
    await page.keyboard.type('Apollo 11 Eag');
  });
  await test.step('Then its landings are found', async () => {
    await expect(
      dialog.locator('.search-hit').filter({ hasText: 'Apollo 11' }).first(),
    ).toBeVisible();
  });
  await test.step('When they open Apollo 11', async () => {
    await dialog.locator('[data-passage="landing:d00274"] .search-hit').click();
  });
  await test.step('Then the view is on the Moon, the day it landed', async () => {
    await expect(page).toHaveURL(/focus=moon/);
    await expect(page).toHaveURL(/t=1969-07-20T20:17Z/);
    await expect(page).toHaveURL(/layers=[^&]*spacecraft/);
  });
  await test.step('And a step back returns to where they were', async () => {
    await page.goBack();
    await expect(page).not.toHaveURL(/focus=moon/);
  });
  expect(problems).toEqual([]);
});
