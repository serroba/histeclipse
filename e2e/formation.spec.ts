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
  await test.step('When they move it back to a million years in, Then the gas and dust ring the growing Earth (#1219)', async () => {
    // Moving the slider holds the clock there, however slowly the runner plays.
    await clock.locator('.strike-clock-range').fill('2');
    await expect(clock.locator('.strike-clock-when')).toHaveText(/^1 million years after/);
    await expect(globe).toHaveAttribute('data-formation-disc', 'gas');
  });
  await test.step('When it plays fast, Then deep time’s moment moves with it, past the impact', async () => {
    await clock.getByLabel('Speed').selectOption('fast');
    await clock.getByRole('button', { name: 'Play', exact: true }).click();
    await expect.poll(() => maOf(page.url()), { timeout: 30_000 }).toBeLessThan(4510);
  });
  await test.step('Then the globe draws the impact, and the Moon gathering from its debris (#180)', async () => {
    await expect(globe).toHaveAttribute('data-formation-impact', 'moon', { timeout: 30_000 });
    await expect(clock.locator('.strike-clock-drawn')).toContainText('Illustration:');
  });
  await test.step('Then at its end it hands back to deep time, which plays on through the aeons', async () => {
    await expect(clock).toBeHidden({ timeout: 30_000 });
    await expect(globe).not.toHaveAttribute('data-formation-clock');
    await expect(globe).toHaveAttribute('data-formation-impact', 'off');
    await expect(globe).toHaveAttribute('data-formation-disc', 'off');
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

test('how fast Earth grew is the reader’s choice, and the formation clock follows it (#1219)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const clock = page.getByRole('dialog', { name: 'Earth and the Moon forming, in their own time' });
  await test.step('Given the aeons before the impact, Then the rail asks how fast Earth grew, slowly by default', async () => {
    await page.goto('./?ma=4540&scale=eons');
    await globeRendered(page);
    await expect(page.getByRole('button', { name: /^How fast Earth grew: Slow/ })).toBeVisible();
  });
  await test.step('When they pick the pebbles, Then the link keeps it', async () => {
    await page.getByRole('button', { name: /^How fast Earth grew/ }).click();
    await page.getByRole('button', { name: /^Fast: pebbles/ }).click();
    await expect(page).toHaveURL(/growth=fast/);
  });
  await test.step('When they play, Then the clock draws Earth growing as the pebbles have it', async () => {
    await page
      .getByRole('navigation', { name: 'Deep time' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await expect(clock).toBeVisible();
    await expect(globe).toHaveAttribute('data-formation-growth', 'fast');
  });
  await test.step('After the impact the rail no longer asks', async () => {
    await page.goto('./?ma=4500&scale=eons&growth=fast');
    await globeRendered(page);
    await expect(page.getByRole('button', { name: /^How fast Earth grew/ })).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('how the impact went is the reader’s choice, and the formation clock draws it (#1220)', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const globe = page.getByTestId('globe');
  const clock = page.getByRole('dialog', { name: 'Earth and the Moon forming, in their own time' });
  await test.step('Given the aeons before the impact, Then the rail asks how it went, canonical by default', async () => {
    await page.goto('./?ma=4520&scale=eons');
    await globeRendered(page);
    await expect(
      page.getByRole('button', { name: /^How the impact went: Canonical/ }),
    ).toBeVisible();
  });
  await test.step('When they pick two half-Earths, Then the link keeps it', async () => {
    await page.getByRole('button', { name: /^How the impact went/ }).click();
    await page.getByRole('button', { name: /^Half-Earths/ }).click();
    await expect(page).toHaveURL(/theia=halfEarths/);
  });
  await test.step('When they play to Theia coming in, Then the clock tells and draws that hit, on its paper’s say-so', async () => {
    await page
      .getByRole('navigation', { name: 'Deep time' })
      .getByRole('button', { name: 'Play', exact: true })
      .click();
    await expect(clock).toBeVisible();
    await expect(globe).toHaveAttribute('data-formation-theia', 'halfEarths');
    await expect(clock).toHaveAttribute('data-phase', 'theia', { timeout: 30_000 });
    await expect(clock.locator('.strike-clock-text')).toContainText('as large as the proto-Earth');
    await expect(clock.locator('.strike-clock-sources')).toContainText('Canup 2012');
  });
  expect(problems).toEqual([]);
});
