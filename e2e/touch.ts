import type { Page } from '@playwright/test';

/**
 * A real one-finger swipe on the screen, from y to y + dy, in `steps` moves a frame (16 ms)
 * apart: stamped with those times, so it is as quick as a finger's whatever the machine.
 */
export async function swipe(
  page: Page,
  x: number,
  y: number,
  dy: number,
  steps = 5,
): Promise<void> {
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
  await cdp.detach();
}

interface Finger {
  move(dy: number, steps?: number): Promise<void>;
  lift(): Promise<void>;
}

/** A finger put down at (x, y), moved slowly by each of `steps`, and held there. */
export async function press(page: Page, x: number, y: number): Promise<Finger> {
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
      await cdp.detach();
    },
  };
}
