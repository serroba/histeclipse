/**
 * Parts with no layer chip (#1130): when their data does not load, the notice says so and offers
 * Try again. Until then they wait: the years moving do not fetch them again.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, skyRendered, test } from './support';

/** Fail `pattern` with a 503 until `restore` is called; count each ask. */
async function unreachable(
  page: Page,
  pattern: string,
): Promise<{ asked: () => number; restore: () => void }> {
  let fail = true;
  let asked = 0;
  await page.route(pattern, (route) => {
    asked += 1;
    return fail ? route.fulfill({ status: 503, body: 'down' }) : route.fallback();
  });
  return {
    asked: () => asked,
    restore: () => {
      fail = false;
    },
  };
}

test('when the radiocarbon curves do not load, the years going by do not ask again, and Try again in the notice draws the strip (#1130) @mobile', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const strip = page.getByTestId('radiocarbon-strip');
  const notice = page.getByRole('status').getByRole('listitem').filter({
    hasText: 'Could not load the radiocarbon curves',
  });
  const curves = await unreachable(page, '**/data/radiocarbon.json');
  await test.step('Given the years with Carbon-14 in the air on, and its curves unreachable', async () => {
    await page.goto('./?t=-0700-06-01T12:00&loc=48,10&layers=radiocarbon');
    await globeRendered(page);
  });
  // One load asks twice: once, and once more past the browser's copy on a 5xx (`retryingFetch`).
  await expect.poll(curves.asked).toBe(2);
  await test.step('Then the notice says so', async () => {
    await expect(notice).toBeVisible();
  });
  await test.step('When they step on through the years, Then the curves are not asked for again', async () => {
    for (let step = 0; step < 5; step++) await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/t=-0695-/);
    expect(curves.asked()).toBe(2);
    await expect(strip).toBeHidden();
  });
  await test.step('When the curves are back and they try again, Then the strip is drawn', async () => {
    curves.restore();
    await notice.getByRole('button', { name: 'Try again' }).click();
    await expect(notice).toBeHidden();
    await expect(strip).toContainText('IntCal20', { timeout: 20_000 });
  });
  expect(problems.filter((problem) => !problem.includes('503'))).toEqual([]);
});

test('when the stars do not load, the sky waits, and Try again in the notice draws it (#1130) @mobile', async ({
  page,
}) => {
  const notice = page.getByRole('status').getByRole('listitem').filter({
    hasText: 'Could not load the stars',
  });
  const stars = await unreachable(page, '**/data/sky.json');
  await test.step('Given the sky over Babylon, and the stars unreachable', async () => {
    await page.goto('./?mode=sky&t=-0567-03-20T19:00&loc=32.5422,44.4209');
    await expect(notice).toBeVisible({ timeout: 20_000 });
  });
  await expect.poll(stars.asked).toBe(2);
  await test.step('When the moment moves on, Then the stars are not asked for again', async () => {
    for (let step = 0; step < 3; step++) await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/t=-0564-/);
    expect(stars.asked()).toBe(2);
  });
  await test.step('When they are back and they try again, Then the sky is drawn', async () => {
    stars.restore();
    await notice.getByRole('button', { name: 'Try again' }).click();
    await skyRendered(page);
  });
});
