/**
 * Feature: The deep-time bar as a sheet. On a phone it folds to its controls, so the globe
 * stays in view; the details follow a finger dragged up or down, settle open or folded when it
 * lifts, and open they scroll inside the bar rather than the page.
 */

import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, test } from './support';

/**
 * A real one-finger swipe on the screen, from y to y + dy, in `steps` moves a frame (16 ms)
 * apart: stamped with those times, so it is as quick as a finger's whatever the machine.
 */
async function swipe(page: Page, x: number, y: number, dy: number, steps = 5): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  const point = (at: number) => [{ x, y: at, id: 1 }];
  const start = Date.now() / 1000;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(y),
    timestamp: start,
  });
  for (let step = 1; step <= steps; step += 1) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: point(y + (dy * step) / steps),
      timestamp: start + step * 0.016,
    });
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
    timestamp: start + (steps + 1) * 0.016,
  });
}

/** A finger put down at (x, y), moved slowly by each of `steps`, and held there. */
async function press(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  let at = y;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  return {
    async move(dy: number, steps = 8): Promise<void> {
      for (let step = 1; step <= steps; step += 1) {
        at += dy / steps;
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: at, id: 1 }],
        });
        await page.waitForTimeout(40);
      }
    },
    async lift(): Promise<void> {
      // Held still a moment first: a lift, not a flick.
      await page.waitForTimeout(150);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    },
  };
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
    // Settled, not only showing: mid-settle the bar is still growing under the next swipe.
    await expect(bar).toHaveAttribute('data-sheet', 'open');
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

test('on a phone the details follow the finger, and settle open or folded when it lifts', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  const problems = collectProblems(page);
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const details = page.getByTestId('deep-details');
  const height = async (): Promise<number> => (await details.boundingBox())?.height ?? 0;
  let x = 0;
  let y = 0;
  await test.step('Given the ice ages on a phone, the details folded', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
    await expect(details).toBeHidden();
    const label = await bar.locator('.deep-label').boundingBox();
    if (label === null) throw new Error('no label');
    x = label.x + 20;
    y = label.y + 10;
  });
  await test.step('When a finger drags the bar up a little, and holds', async () => {
    const finger = await press(page, x, y);
    await finger.move(-50);
    await test.step('Then the details have come up with it, about as far', async () => {
      await expect(details).toBeVisible();
      expect(await height()).toBeGreaterThan(30);
      expect(await height()).toBeLessThan(70);
    });
    await test.step('And let go so soon, they fold back', async () => {
      await finger.lift();
      await expect(details).toBeHidden();
    });
  });
  await test.step('When a finger drags them up most of the way, slowly, and lets go', async () => {
    const finger = await press(page, x, y);
    await finger.move(-260, 12);
    await finger.lift();
  });
  await test.step('Then they settle open', async () => {
    await expect(bar).toHaveAttribute('data-sheet', 'open');
    await expect(details).toBeVisible();
  });
  await test.step('When a quick flick goes down, not far', async () => {
    const label = await bar.locator('.deep-label').boundingBox();
    if (label === null) throw new Error('no label');
    await swipe(page, label.x + 20, label.y + 10, 80, 2);
  });
  await test.step('Then they fold, the way the flick went', async () => {
    await expect(bar).toHaveAttribute('data-sheet', 'folded');
  });
  expect(problems).toEqual([]);
});

test('on a desktop, the handle can be dragged with the mouse as well as clicked', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse');
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  const handle = page.getByRole('button', { name: /the details$/ });
  await test.step('Given deep time with the details folded', async () => {
    await page.goto('./?ma=250');
    await globeRendered(page);
    if ((await handle.getAttribute('aria-expanded')) === 'true') await handle.click();
    await expect(bar).toHaveAttribute('data-sheet', 'folded');
  });
  await test.step('When they drag the handle up slowly and let go', async () => {
    const box = await handle.boundingBox();
    if (box === null) throw new Error('no handle');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 300, { steps: 20 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  });
  await test.step('Then the details settle open, and the drag was not taken for a click', async () => {
    await expect(bar).toHaveAttribute('data-sheet', 'open');
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
  });
});

test('a second swipe straight after the first goes the way it was swiped', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout');
  const bar = page.getByRole('navigation', { name: 'Deep time' });
  await test.step('Given the ice ages on a phone, the details folded', async () => {
    await page.goto('./?ma=0.021&scale=ice');
    await globeRendered(page);
    await expect(bar).toHaveAttribute('data-sheet', 'folded');
  });
  await test.step('When they flick up and, before it settles, flick down', async () => {
    const label = await bar.locator('.deep-label').boundingBox();
    if (label === null) throw new Error('no label');
    await swipe(page, label.x + 20, label.y + 10, -120, 2);
    await swipe(page, label.x + 20, label.y - 20, 120, 2);
  });
  await test.step('Then the details end folded, the way the last flick went', async () => {
    await page.waitForTimeout(400);
    await expect(bar).toHaveAttribute('data-sheet', 'folded');
  });
});

test('deep time’s sheet never reaches up over the date panel', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop-120hz', 'about layout, not frames');
  for (const link of ['./?ma=0.021&scale=ice', './?ma=250&scale=all', './?ma=3000&scale=eons']) {
    await test.step(`Given ${link}`, async () => {
      await page.goto(link);
      await globeRendered(page);
    });
    await test.step('Then the sheet and the date panel share no pixels', async () => {
      await expect(async () => {
        const panel = await page.locator('.hud').boundingBox();
        const sheet = await page.locator('.deep-time').boundingBox();
        if (panel === null || sheet === null) throw new Error('not laid out');
        const apart =
          sheet.y >= panel.y + panel.height ||
          sheet.x >= panel.x + panel.width ||
          sheet.x + sheet.width <= panel.x;
        expect(apart).toBe(true);
      }).toPass();
    });
  }
});
