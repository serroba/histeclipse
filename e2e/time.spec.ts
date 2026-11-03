/**
 * Feature: Time. The reader is always in one of two times, the Holocene (the calendar, states
 * and eclipses) or deep time (millions of years), and switches between them from the top row.
 * Famous eclipses are events of the Holocene, so they sit with the year's eclipses.
 */

import { expect, test } from '@playwright/test';

import { collectProblems, globeRendered } from './support';

test('the top row picks the time; famous eclipses sit with the year’s eclipses', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const time = page.getByRole('group', { name: 'Time' });
  await test.step('Given a reader in 2024', async () => {
    await page.goto('./?t=2024-04-08T18:17');
    await globeRendered(page);
  });
  await test.step('Then the top row offers the Holocene and deep time, with the Holocene on', async () => {
    await expect(time.getByRole('button', { name: 'Holocene' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(time.getByRole('button', { name: 'Deep time' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  await test.step('And Famous eclipses is in the year bar, not the top row', async () => {
    const bar = page.getByRole('navigation', { name: 'Year and eclipses' });
    await expect(bar.getByRole('button', { name: 'Famous eclipses' })).toBeVisible();
    await expect(page.locator('.hud').getByRole('button', { name: 'Famous eclipses' })).toHaveCount(
      0,
    );
  });
  await test.step('When they pick Holocene again, nothing changes', async () => {
    const before = page.url();
    await time.getByRole('button', { name: 'Holocene' }).click();
    expect(page.url()).toBe(before);
  });
  expect(problems).toEqual([]);
});

test('from deep time, picking the Holocene returns to the date and eclipse left', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const time = page.getByRole('group', { name: 'Time' });
  await test.step('Given a reader at the 2024 eclipse', async () => {
    await page.goto('./?t=2024-04-08T18:17&sel=solar:2024-04-08');
    await globeRendered(page);
  });
  await test.step('When they pick Deep time', async () => {
    await time.getByRole('button', { name: 'Deep time' }).click();
  });
  await test.step('Then deep time is on, with no famous eclipses to pick', async () => {
    await expect(page).toHaveURL(/&ma=250(&|$)/);
    await expect(time.getByRole('button', { name: 'Deep time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Famous eclipses' })).toBeHidden();
  });
  await test.step('And picking Deep time again keeps them there', async () => {
    await time.getByRole('button', { name: 'Deep time' }).click();
    await expect(page).toHaveURL(/&ma=250(&|$)/);
  });
  await test.step('When they pick Holocene', async () => {
    await time.getByRole('button', { name: 'Holocene' }).click();
  });
  await test.step('Then the date and eclipse they left come back', async () => {
    await expect(page).not.toHaveURL(/ma=/);
    await expect(page.locator('.hud-date')).toHaveText('8 April 2024 CE');
    await expect(page).toHaveURL(/sel=solar:2024-04-08/);
    await expect(page.getByLabel('Year', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Famous eclipses' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('a link to deep time opens with Deep time picked', async ({ page }) => {
  await test.step('Given a link 985,000 years back', async () => {
    await page.goto('./?ma=0.985&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then Deep time is the time shown', async () => {
    const time = page.getByRole('group', { name: 'Time' });
    await expect(time.getByRole('button', { name: 'Deep time' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(time.getByRole('button', { name: 'Holocene' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});
