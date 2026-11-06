/**
 * Feature: The deep-time bar as a sheet. On a phone it folds to its controls, so the globe
 * stays in view; a swipe up opens the details, a swipe down folds them, and open they scroll
 * inside the bar rather than the page.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

/** A real one-finger swipe on the screen, from y to y + dy. */
async function swipe(page: Page, x: number, y: number, dy: number): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (at: number) => [{ x, y: at, id: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(y) });
  for (let step = 1; step <= 5; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(y + (dy * step) / 5),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('on a phone the deep-time bar folds to its controls, and swipes open and shut', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const details = page.getByTestId('deep-details');
  await test.step('Given the ice ages on a phone', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
  });
  await test.step('Then the bar shows its controls only, and the page does not scroll', async () => {
    await expect(bar.getByRole('slider')).toBeVisible();
    await expect(details).toBeHidden();
    const scrolls = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1,
    );
    expect(scrolls).toBe(false);
  });
  await test.step('When they swipe the bar up', async () => {
    const label = await bar.locator('.deep-label').boundingBox();
    if (label === null) throw new Error('no label');
    await swipe(page, label.x + 20, label.y + 10, -120);
  });
  await test.step('Then the details open within the screen, and scroll inside the bar', async () => {
    await expect(details).toBeVisible();
    const box = await bar.boundingBox();
    const viewport = page.viewportSize();
    if (box === null || viewport === null) throw new Error('no layout');
    expect(box.y).toBeGreaterThan(viewport.height * 0.2);
    await expect(
      page.getByRole('group', { name: 'Time span' }).getByRole('button', { name: 'Years' }),
    ).toBeInViewport();
  });
  await test.step('When they swipe the bar down, it folds again', async () => {
    const label = await bar.locator('.deep-label').boundingBox();
    if (label === null) throw new Error('no label');
    await swipe(page, label.x + 20, label.y + 10, 160);
    await expect(details).toBeHidden();
  });
  expect(problems).toEqual([]);
});

test('the handle folds and opens the details, on any screen', async ({ page }) => {
  const details = page.getByTestId('deep-details');
  const handle = page.getByRole('button', { name: /the details$/ });
  await test.step('Given deep time 250 million years ago', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
  });
  await test.step('When they tap the handle, the details turn the other way', async () => {
    const open = await details.isVisible();
    await handle.click();
    await expect(details).toBeVisible({ visible: !open });
    await expect(handle).toHaveAttribute('aria-expanded', String(!open));
  });
  await test.step('And tapping it again turns them back', async () => {
    const open = await details.isVisible();
    await handle.click();
    await expect(details).toBeVisible({ visible: !open });
  });
});
