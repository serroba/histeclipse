/**
 * Feature: The keys of all that plays. Whatever is playing (the years, deep time, an eclipse,
 * the tree through time, the planetary boundaries), Space plays or pauses it and the left and
 * right arrows step it back and on, with the focus anywhere. The carbon-14 story's keys are in
 * `carbon.spec.ts`; which keys are left to a button or a field is unit-tested.
 */

import type { Locator } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

// Keys are a keyboard's: the phone's project has none.
test.skip(({ isMobile }) => isMobile, 'a phone has no keyboard');

/** The slider's value now. */
const valueOf = async (slider: Locator): Promise<number> => Number(await slider.inputValue());

test('the years travel and stop on Space, and step a year on the arrows', async ({ page }) => {
  const problems = collectProblems(page);
  const bar = page.getByRole('group', { name: 'Holocene' });
  const slider = bar.getByRole('slider', { name: 'Year in the Holocene' });
  await test.step('Given 600 BCE, with nothing focused', async () => {
    await page.goto('./?t=-599-06-01T12:00');
    await globeRendered(page);
  });
  await test.step('When they press the right arrow, then Shift and the left', async () => {
    const year = await valueOf(slider);
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(year + 1));
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(slider).toHaveValue(String(year - 9));
  });
  await test.step('Then Space starts the trip through the years, and Space again stops it', async () => {
    await page.keyboard.press('Space');
    await expect(bar.getByRole('button', { name: 'Stop travelling' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(bar.getByRole('button', { name: 'Travel through the years' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('deep time plays and pauses on Space, and steps on the arrows', async ({ page }) => {
  const problems = collectProblems(page);
  const deep = page.getByRole('navigation', { name: 'Deep time' });
  const slider = deep.getByRole('slider', { name: 'Millions of years ago' });
  await test.step('Given deep time, 300 million years ago', async () => {
    await page.goto('./?ma=300');
    await globeRendered(page);
    await expect(slider).toHaveValue('-300');
  });
  await test.step('When they press the left arrow, the moment is a step earlier', async () => {
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => valueOf(slider)).toBeLessThan(-300);
  });
  await test.step('Then Space plays towards today, and Space again pauses', async () => {
    await page.keyboard.press('Space');
    await expect(deep.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(deep.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('an eclipse plays and pauses on Space, and steps a minute on the arrows', async ({ page }) => {
  const problems = collectProblems(page);
  const slider = page.getByRole('slider', { name: 'Time relative to greatest eclipse' });
  const scrubber = page.locator('.scrubber');
  await test.step('Given the lunar eclipse of March 2025, picked', async () => {
    await page.goto('./?t=2025-03-14T06:59&sel=lunar:2025-03-14');
    await globeRendered(page);
    await expect(slider).toBeVisible();
  });
  await test.step('When they press the arrows, the shadow moves a minute on, then ten back', async () => {
    const minutes = await valueOf(slider);
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(minutes + 1));
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(slider).toHaveValue(String(minutes - 9));
  });
  await test.step('Then Space plays the eclipse, and Space again pauses it', async () => {
    await page.keyboard.press('Space');
    await expect(scrubber.getByRole('button', { name: 'Pause' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(scrubber.getByRole('button', { name: 'Play' })).toBeVisible();
  });
  expect(problems).toEqual([]);
});

test('a sheet over the page takes the keys: the tree through time, not the years beneath', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const slider = page.getByTestId('lineages-slider');
  const play = page.getByTestId('lineages-play');
  const years = page.getByRole('slider', { name: 'Year in the Holocene' });
  let year = '';
  await test.step('Given the dinosaurs’ tree through time, open', async () => {
    await page.goto('./?lineages=dinosaurs');
    await expect(page.getByTestId('lineages-canvas')).toHaveAttribute('data-ma', /\d/, {
      timeout: 30_000,
    });
    year = await years.inputValue();
  });
  await test.step('And its Close button holding the focus, as a sheet opened by a click leaves it', async () => {
    await page.locator('#lineages-title').click({ position: { x: 4, y: 4 } });
    await page
      .getByRole('dialog', { name: /Life through time/ })
      .getByRole('button', { name: 'Close' })
      .focus();
  });
  await test.step('When they press Space, it pauses or plays the tree', async () => {
    const before = await play.getAttribute('aria-label');
    await page.keyboard.press('Space');
    await expect(play).toHaveAttribute('aria-label', before === 'Pause' ? 'Play' : 'Pause');
    if (before !== 'Pause') await page.keyboard.press('Space');
    await expect(play).toHaveAttribute('aria-label', 'Play');
  });
  await test.step('Then an arrow steps it half a million years, and the year stays', async () => {
    const at = await valueOf(slider);
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue(String(at + 0.5));
    await page.keyboard.press('ArrowLeft');
    await expect(slider).toHaveValue(String(at));
    await expect(years).toHaveValue(year);
  });
  expect(problems).toEqual([]);
});

test('the planetary boundaries pause on Space, and the arrows turn the wheel’s chapters', async ({
  page,
}) => {
  const problems = collectProblems(page);
  const sheet = page.getByTestId('boundaries-sheet');
  const stage = page.getByTestId('boundary-stage');
  await test.step('Given the boundaries compared, playing', async () => {
    await page.goto('./?boundaries=compare');
    await expect(stage).toHaveAttribute('data-chapter', 'compare', { timeout: 30_000 });
    await expect(sheet.getByRole('button', { name: 'Pause' })).toBeVisible();
  });
  await test.step('And its Close button holding the focus, as a sheet opened by a click leaves it', async () => {
    await page.locator('#boundaries-title').click({ position: { x: 4, y: 4 } });
    await sheet.getByRole('button', { name: 'Close' }).focus();
  });
  await test.step('When they press Space, it pauses', async () => {
    await page.keyboard.press('Space');
    await expect(sheet.getByRole('button', { name: 'Play' })).toBeVisible();
    await expect(stage).toHaveAttribute('data-playing', 'false');
  });
  await test.step('Then the left arrow turns to the chapter before', async () => {
    await page.keyboard.press('ArrowLeft');
    await expect(stage).not.toHaveAttribute('data-chapter', 'compare');
  });
  expect(problems).toEqual([]);
});
