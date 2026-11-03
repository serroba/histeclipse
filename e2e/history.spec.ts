/**
 * Feature: Travelling through the Holocene. A track above the year bar plays the years by, at a
 * chosen speed, and with the states layer on says which states appear and which are gone.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

const track = 'Holocene';

async function openTrack(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Travel', exact: true }).click();
  await expect(page.getByRole('group', { name: track })).toBeVisible();
}

test('playing history moves through the years and names the states that come and go', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 600 BCE with states and empires on', async () => {
    await page.goto('./?t=-599-06-01T12:00&layers=lunar,solar,empires');
    await globeRendered(page);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  });
  await test.step('When they open the track, pick 200 years a second and play', async () => {
    await openTrack(page);
    await bar.getByLabel('Speed').selectOption('200');
    await bar.getByRole('button', { name: 'Travel through the years' }).click();
  });
  await test.step('Then the years run on, and the track names states that appeared or went', async () => {
    await expect(page.locator('.hud-date')).toHaveText(/ CE$/, { timeout: 20_000 });
    await expect(bar.getByTestId('history-changes')).toHaveText(/^By \d+ (BCE|CE): /);
  });
  await test.step('When they pause, the year stays and the link keeps it', async () => {
    await bar.getByRole('button', { name: 'Stop travelling' }).click();
    const shown = await page.locator('.hud-date').textContent();
    await page.waitForTimeout(500);
    await expect(page.locator('.hud-date')).toHaveText(shown ?? '');
    await expect(page).not.toHaveURL(/t=-599-/);
  });
  expect(problems).toEqual([]);
});

test('the track jumps to any year of the Holocene', async ({ page }) => {
  const bar = page.getByRole('group', { name: track });
  await test.step('Given 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('When they open the track and move it to 1000 CE', async () => {
    await openTrack(page);
    await bar.getByRole('slider', { name: 'Year in the Holocene' }).fill('1000');
  });
  await test.step('Then the globe shows that year', async () => {
    await expect(page).toHaveURL(/t=1000-/);
    await expect(page.getByLabel('Year', { exact: true })).toHaveValue('1000');
  });
  await test.step('And with states off, the track says how to watch them', async () => {
    await expect(bar.getByTestId('history-changes')).toHaveText(
      'Turn on States and empires in Layers to watch them come and go.',
    );
  });
});

test('the track goes with the Holocene into deep time', async ({ page }) => {
  await page.goto('./?ma=250');
  await globeRendered(page);
  await expect(page.getByRole('group', { name: track })).toBeHidden();
});

test('the track opens from the year bar and folds away again', async ({ page }) => {
  const bar = page.getByRole('group', { name: track });
  await test.step('Given the globe in 2024, with the track folded away', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
    await expect(bar).toBeHidden();
  });
  await test.step('When they open it and close it', async () => {
    await openTrack(page);
    await bar.getByRole('button', { name: 'Close the track' }).click();
  });
  await test.step('Then it folds away, and Travel says so', async () => {
    await expect(bar).toBeHidden();
    await expect(page.getByRole('button', { name: 'Travel', exact: true })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
