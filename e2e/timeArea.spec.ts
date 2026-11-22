/**
 * Feature: one Time area on a phone (#752). The layers on have one place in deep time's bar, the
 * Layers panel is where one is switched on, and a sheet opened over the globe leaves the time
 * bar as a strip under it rather than competing with it. The focus comes back where it left.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

/** The gap between the open sheet's bottom and the time bar's top, px: under 0 is an overlap. */
async function sheetGap(page: Page, sheet: string): Promise<number> {
  return page.evaluate((selector) => {
    const bottom = document.querySelector(selector)?.getBoundingClientRect().bottom ?? Infinity;
    const top = document.querySelector('.bottom')?.getBoundingClientRect().top ?? 0;
    return top - bottom;
  }, sheet);
}

test('on a phone, the layers on sit in the bar, Layers adds one, and a sheet leaves time in reach @mobile', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'a phone’s journey');
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const dock = page.getByRole('group', { name: 'The time bar’s layers' });
  const add = dock.getByRole('button', { name: 'Add a layer' });
  const panel = page.getByRole('dialog', { name: 'Layers' });
  await test.step('Given 100 million years ago with Temperature on, the bar’s details open', async () => {
    await page.goto('./?ma=100&layers=temperature');
    await globeRendered(page);
    await bar.locator('.deep-handle').click();
    await expect(page.getByTestId('deep-details')).toBeVisible();
  });
  await test.step('Then the dock holds Temperature and Add, not every layer', async () => {
    await expect(dock.getByRole('button').filter({ visible: true })).toHaveText([
      'Temperature',
      'Add',
    ]);
  });
  await test.step('When they add a layer, Then the sheet sits on the time strip, not over it', async () => {
    await add.click();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('deep-details')).toBeHidden();
    await expect(bar.getByRole('slider', { name: 'Millions of years ago' })).toBeInViewport();
    await expect(bar.getByRole('button', { name: 'Play' })).toBeInViewport();
    expect(await sheetGap(page, '.layers-dialog')).toBeGreaterThanOrEqual(-1);
  });
  await test.step('When they tick Impact craters and close the sheet with Escape', async () => {
    await panel.getByRole('checkbox', { name: 'Impact craters', exact: true }).check();
    await page.keyboard.press('Escape');
  });
  await test.step('Then the bar is back as they left it, Impacts docked, the focus on Add', async () => {
    await expect(panel).toBeHidden();
    await expect(page.getByTestId('deep-details')).toBeVisible();
    await expect(dock.getByRole('button', { name: 'Impacts', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(add).toBeFocused();
    await expect(page).toHaveURL(/layers=[a-z,]*impacts/);
  });
  await test.step('When they turn Impacts off from the dock, Then it goes and the focus is on Add', async () => {
    await dock.getByRole('button', { name: 'Impacts', exact: true }).click();
    await expect(dock.getByRole('button', { name: 'Impacts', exact: true })).toBeHidden();
    await expect(add).toBeFocused();
    await expect(page).not.toHaveURL(/impacts/);
    await expect(page).toHaveURL(/ma=100/);
  });
  await test.step('When they open Explore, Then the time strip stays under it too', async () => {
    await page.getByRole('button', { name: 'Explore' }).click();
    await expect(page.getByRole('dialog', { name: 'Explore' })).toBeVisible();
    await expect(bar.getByRole('slider', { name: 'Millions of years ago' })).toBeInViewport();
    expect(await sheetGap(page, '.explore-dialog')).toBeGreaterThanOrEqual(-1);
  });
  expect(problems).toEqual([]);
});
