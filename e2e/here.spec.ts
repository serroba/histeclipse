/** What is written about here: the passages anchored where the reader looks, when (#391). */

import { collectProblems, expect, globeRendered, test } from './support';

test('a reader over the Moon in 1969 reads what is written about there, and opens it', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const here = page.getByTestId('here-list');
  await test.step('Given the Moon seen over the Sea of Tranquillity in July 1969', async () => {
    await page.goto('./?t=1969-07-21T00:00Z&focus=moon&cam=0.7,23.4,1.8');
    await globeRendered(page);
  });
  await test.step('When they open About here', async () => {
    await page.getByText('About here', { exact: true }).click();
  });
  await test.step('Then Apollo 11 comes first, with where it came down', async () => {
    const first = here.locator('li').first();
    await expect(first).toContainText('Apollo 11');
    await expect(first).toContainText('The Moon · 0.7°N 23.4°E · 1969 CE');
  });
  await test.step('When they open it', async () => {
    await here.locator('li').first().getByRole('button').click();
  });
  await test.step('Then the view goes to the landing, the day it happened, craft shown', async () => {
    await expect(page).toHaveURL(/t=1969-07-20T20:17Z/);
    await expect(page).toHaveURL(/layers=[^&]*spacecraft/);
  });
  expect(problems).toEqual([]);
});

test('a reader over the Pacific is told nothing is written there yet', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given Earth over the Pacific in 1223 BCE', async () => {
    await page.goto('./?t=-1222-03-05T12:00Z&cam=0,-160,1.5');
    await globeRendered(page);
  });
  await test.step('When they open About here', async () => {
    await page.getByText('About here', { exact: true }).click();
  });
  await test.step('Then they are pointed to search', async () => {
    await expect(page.getByTestId('here-list')).toContainText('Nothing written about here yet');
  });
  expect(problems).toEqual([]);
});
