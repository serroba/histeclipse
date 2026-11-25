/**
 * The aeons begin with Earth and the Moon forming (#1218): playing deep time from before the
 * giant impact opens the formation clock, which carries deep time along and hands back to it.
 */

import { expect, test } from '@playwright/test';

import { collectProblems, globeRendered } from './support';

/** Deep time's moment, Ma, as the link has it. */
function maOf(url: string): number {
  return Number(new URL(url).searchParams.get('ma'));
}

test('playing the aeons from their oldest moment opens on Earth and the Moon forming, then plays on @acceptance', async ({
  page,
}) => {
  test.slow();
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const clock = page.getByRole('dialog', { name: 'Earth and the Moon forming, in their own time' });
  await test.step('Given the aeons at their oldest moment', async () => {
    await page.goto('./?ma=4568&scale=eons');
    await globeRendered(page);
  });
  await test.step('When they play', async () => {
    await bar.getByRole('button', { name: 'Play', exact: true }).click();
  });
  await test.step('Then the formation clock opens at the first solids, saying whose studies say so', async () => {
    await expect(clock).toBeVisible();
    await expect(globe).toHaveAttribute('data-formation-clock', 'early');
    await expect(clock.locator('.strike-clock-when')).toHaveText(/after the first solids$/);
    await expect(clock.locator('.strike-clock-phase')).not.toBeEmpty();
    await expect(clock.locator('.strike-clock-sources a').first()).toHaveAttribute(
      'href',
      /^https:\/\/doi\.org\/10\./,
    );
  });
  await test.step('When it plays fast, Then deep time’s moment moves with it, past the impact', async () => {
    await clock.getByLabel('Speed').selectOption('fast');
    await expect.poll(() => maOf(page.url()), { timeout: 30_000 }).toBeLessThan(4510);
  });
  await test.step('Then the globe draws the impact, and the Moon gathering from its debris (#180)', async () => {
    await expect(globe).toHaveAttribute('data-formation-impact', 'moon', { timeout: 30_000 });
  });
  await test.step('Then at its end it hands back to deep time, which plays on through the aeons', async () => {
    await expect(clock).toBeHidden({ timeout: 30_000 });
    await expect(globe).not.toHaveAttribute('data-formation-clock');
    await expect(globe).toHaveAttribute('data-formation-impact', 'off');
    await expect(bar.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(() => maOf(page.url()), { timeout: 30_000 }).toBeLessThan(4500);
  });
  expect(problems).toEqual([]);
});

test('closing the formation clock skips to after it, and deep time plays on (#1218)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const clock = page.getByRole('dialog', { name: 'Earth and the Moon forming, in their own time' });
  await test.step('Given deep time playing from before a young impact', async () => {
    await page.goto('./?ma=4400&scale=eons&impact=young');
    await globeRendered(page);
    await bar.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(clock).toBeVisible();
    await expect(page.getByTestId('globe')).toHaveAttribute('data-formation-clock', 'young');
  });
  await test.step('When Theia comes in, Then the globe draws it before the strike (#180)', async () => {
    await expect(clock).toHaveAttribute('data-phase', 'theia', { timeout: 20_000 });
    await expect(page.getByTestId('globe')).toHaveAttribute('data-formation-impact', 'theia');
  });
  await test.step('When they close the clock, Then deep time plays on from 10 million years after the impact', async () => {
    await clock.getByRole('button', { name: 'Close' }).click();
    await expect(clock).toBeHidden();
    await expect(bar.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await expect.poll(() => maOf(page.url())).toBeLessThanOrEqual(4340);
  });
  expect(problems).toEqual([]);
});

test('for a reader who asks for less motion, the aeons play without the formation clock (#1218)', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  await page.goto('./?ma=4568&scale=eons');
  await globeRendered(page);
  await bar.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => maOf(page.url())).toBeLessThan(4567);
  await expect(
    page.getByRole('dialog', { name: 'Earth and the Moon forming, in their own time' }),
  ).toBeHidden();
});
