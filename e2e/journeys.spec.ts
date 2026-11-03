/**
 * Journeys: what a reader does from landing to leaving, across features. Each feature has its
 * own scenarios; these check the features still work together, in the order people use them.
 * The catalogue is in `e2e/README.md`.
 */

import { collectProblems, expect, globeRendered, openLayers, test } from './support';

test('a newcomer starts with a famous eclipse and looks at the sky that day', async ({ page }) => {
  const problems = collectProblems(page);
  await test.step('Given a first visit', async () => {
    await page.goto('./');
    await globeRendered(page);
  });
  await test.step('When they start with a famous eclipse and pick Thales', async () => {
    await page
      .getByTestId('welcome')
      .getByRole('button', { name: 'Start with a famous eclipse' })
      .click();
    await page
      .getByRole('dialog', { name: 'Famous eclipses' })
      .getByRole('button', { name: /The eclipse of Thales/ })
      .click();
  });
  await test.step('Then they land on it, with its history and the debate', async () => {
    await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
    await expect(page.locator('.famous-card-title')).toHaveText('The eclipse of Thales');
    await expect(page.locator('.famous-card-debate')).toContainText('Debated');
  });
  await test.step('When they look at the sky from there', async () => {
    await page.getByRole('button', { name: 'Sky' }).click();
  });
  await test.step('Then the sky draws, and Orbit brings the globe back', async () => {
    await expect(page.getByTestId('sky')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Orbit' }).click();
    await globeRendered(page);
    await expect(page).toHaveURL(/sel=solar:-0584-05-28/);
  });
  expect(problems).toEqual([]);
});

test('a historian follows the eclipses seen from one empire', async ({ page }) => {
  const problems = collectProblems(page);
  const seen = page.getByLabel('Seen from', { exact: true });
  await test.step('Given the globe in 763 BCE', async () => {
    await page.goto('./?t=-762-06-15T12:00&cam=35,43,3');
    await globeRendered(page);
  });
  await test.step('When they turn on states and empires and pick Assyria', async () => {
    await openLayers(page);
    await page.getByRole('checkbox', { name: 'States and empires' }).check();
    await page.keyboard.press('Escape');
    await seen.selectOption('Neo-Assyrian Empire');
  });
  await test.step('Then the eclipses seen from there are marked', async () => {
    await expect(page).toHaveURL(/seen=Neo-Assyrian\+Empire/);
    await expect(page.getByTestId('seen-status')).toHaveText(/^[1-9]\d* of \d+ seen$/);
  });
  await test.step('When they step to the next one seen from there', async () => {
    await page.getByRole('button', { name: 'Next eclipse seen from there' }).click();
  });
  await test.step('Then an eclipse is picked, and the link holds it all', async () => {
    await expect(page).toHaveURL(/sel=(lunar|solar):/);
    const link = page.url();
    await page.goto(link);
    await globeRendered(page);
    await expect(seen).toHaveValue('Neo-Assyrian Empire');
    await expect(page).toHaveURL(/layers=[a-z,]*empires/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
  });
  expect(problems).toEqual([]);
});

test('a reader travels into the ice ages and back to the day they left', async ({ page }) => {
  const problems = collectProblems(page);
  const time = page.getByRole('group', { name: 'Time' });
  await test.step('Given a reader at the 2024 eclipse', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
  });
  await test.step('When they go to deep time, narrow it to the ice ages and play', async () => {
    await time.getByRole('button', { name: 'Deep time' }).click();
    await page.getByRole('button', { name: 'Ice ages' }).click();
    await expect(page.locator('.hud-date')).toHaveText('21,000 years ago');
    await page.getByRole('button', { name: 'Play' }).click();
  });
  await test.step('Then time runs to the present and stops there', async () => {
    await expect(page.locator('.hud-date')).toHaveText('Today');
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
  await test.step('When they go back to the Holocene', async () => {
    await time.getByRole('button', { name: 'Holocene' }).click();
  });
  await test.step('Then the day and the eclipse they left are there', async () => {
    await expect(page.locator('.hud-date')).toHaveText('8 April 2024 CE');
    await expect(page).toHaveURL(/sel=solar:2024-04-08/);
    await expect(page).not.toHaveURL(/ma=/);
  });
  expect(problems).toEqual([]);
});

test('a link someone shares opens exactly what they saw', async ({ page }) => {
  const problems = collectProblems(page);
  const shared =
    './?t=-584-05-28T14:26&sel=solar:-0584-05-28&layers=lunar,solar,empires&borders=both';
  await test.step('Given a link to the eclipse of Thales with both sources of borders', async () => {
    await page.goto(shared);
    await globeRendered(page);
  });
  await test.step('Then the eclipse, its history and both sources of borders show', async () => {
    await expect(page.locator('.famous-card-title')).toHaveText('The eclipse of Thales');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-empires', /^[1-9]\d*$/);
    await expect(page.getByTestId('globe')).toHaveAttribute('data-ohm-borders', /^[1-9]\d*$/);
    await openLayers(page);
    await expect(page.getByLabel('Borders from')).toHaveValue('both');
  });
  expect(problems).toEqual([]);
});
