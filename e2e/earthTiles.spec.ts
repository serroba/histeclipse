import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, GPU, test } from './support';

/**
 * Close up, Earth's full-size Blue Marble comes in tiles (#568): only those in view, and none at
 * the usual distance. Very close in, the 500 m map's tiles instead (#569), and only there.
 * Phones take them too, fewer at once (#578); graphics that cannot hold the
 * 4096 map take none, and the camera stops at 1.05 radii.
 */

/** The most tiles a phone draws at once and keeps (`src/globe/tileLimits.ts`). */
const PHONE_SHOWN = 12;
const PHONE_KEPT = 16;

/** The tiles asked for, by path under the tiles' folder. */
function tileRequests(page: Page): string[] {
  const tiles: string[] = [];
  page.on('request', (request) => {
    const match = /\/textures\/earth-tiles\/(.+)$/.exec(request.url());
    if (match?.[1] !== undefined) tiles.push(match[1]);
  });
  return tiles;
}

/** How many tiles are drawn, were fetched and are kept, as the globe reports them. */
async function tileCounts(page: Page): Promise<[shown: number, fetched: number, kept: number]> {
  const counts = (await page.getByTestId('globe').getAttribute('data-earth-tiles')) ?? '0/0/0';
  const [shown = 0, fetched = 0, kept = 0] = counts.split('/').map(Number);
  return [shown, fetched, kept];
}

test(
  'close up, Earth’s map comes in tiles, only those in view, the sharpest only very close in; from afar, none',
  GPU,
  async ({ page }, info) => {
    // The scene is heavy, and CI draws it in software.
    test.slow();
    const problems = collectProblems(page);
    const phone = info.project.name === 'mobile';
    const tiles = tileRequests(page);
    const globe = page.getByTestId('globe');
    await test.step('Given Earth at the usual distance', async () => {
      await page.goto('./?t=2024-04-08T12:00Z');
      await globeRendered(page);
    });
    await test.step('Then no tile is fetched, nor their list', async () => {
      await expect(globe).toHaveAttribute('data-earth-tiles', '0/0/0');
      expect(tiles).toEqual([]);
    });
    await test.step('When they come down to 50 km over the Nile', async () => {
      await page.goto('./?t=2024-04-08T12:00Z&cam=30,31,1.008');
      await globeRendered(page);
      await expect(globe).toHaveAttribute('data-sharp', 'earth', { timeout: 30_000 });
    });
    await test.step('Then only the 500 m tile beneath is fetched and drawn, on a phone too', async () => {
      await expect(globe).toHaveAttribute('data-earth-tiles', '1/1/1', { timeout: 30_000 });
      // 30° N 31° E: level 5's 38th tile east of 180° W and 11th south of the pole, 5.625° a side.
      expect(tiles).toEqual(['manifest.json', '5/37/10.webp']);
    });
    // A phone takes tiles from nearer in (1.3 radii), where its tall view holds fewer.
    const height = phone ? '1.2' : '1.3';
    await test.step('When they rise over the corner of four tiles', async () => {
      tiles.length = 0;
      await page.goto(`./?t=2024-04-08T12:00Z&cam=22.5,22.5,${height}`);
      await globeRendered(page);
    });
    await test.step('Then those four and their neighbours in view, and no others', async () => {
      await expect(globe).toHaveAttribute('data-earth-tiles', /^([4-9]|1[0-6])\/\1\/\1$/, {
        timeout: 30_000,
      });
      const fetched = tiles.filter((tile) => tile !== 'manifest.json');
      // From this high, the full Blue Marble's tiles: none of the 500 m map's.
      expect(fetched.every((tile) => tile.startsWith('4/'))).toBe(true);
      expect(fetched).toEqual(
        expect.arrayContaining(['4/17/5.webp', '4/18/5.webp', '4/17/6.webp']),
      );
      expect(fetched).toContain('4/18/6.webp');
      if (phone) expect(fetched.length).toBeLessThanOrEqual(PHONE_SHOWN);
      // The view is some 40° across at most: within two tiles of the corner, never the far side.
      for (const tile of fetched) {
        const [, x = -1, y = -1] = tile.split(/[/.]/).map(Number);
        expect(x).toBeGreaterThanOrEqual(15);
        expect(x).toBeLessThanOrEqual(20);
        expect(y).toBeGreaterThanOrEqual(3);
        expect(y).toBeLessThanOrEqual(8);
      }
    });
    expect(problems).toEqual([]);
  },
);

test('a phone keeps no more tiles than its budget, letting go those it saw longest ago', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'the phone’s budget');
  test.slow();
  // Each drag waits on new tiles, which CI draws in software: more than the slow test's 90 s.
  test.setTimeout(240_000);
  const problems = collectProblems(page);
  const tiles = tileRequests(page);
  const canvas = page.getByTestId('globe').locator('canvas');
  await test.step('Given Earth from 1,300 km over New Zealand’s South Island', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&cam=-43.5,170.5,1.2');
    await globeRendered(page);
    await expect
      .poll(async () => (await tileCounts(page))[0], { timeout: 30_000 })
      .toBeGreaterThan(0);
  });
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no canvas');
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (let drag = 1; drag <= 6; drag += 1) {
    await test.step(`When they drag the globe round, ${String(drag)} of 6`, async () => {
      // Left to right, clear of the zoom rail on the right.
      await page.mouse.move(box.x + box.width * 0.1, middle.y);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, middle.y, { steps: 8 });
      await page.mouse.up();
      // The view now holds other tiles: wait for some to be drawn.
      await expect
        .poll(async () => (await tileCounts(page))[0], { timeout: 30_000 })
        .toBeGreaterThan(0);
      const [shown, , kept] = await tileCounts(page);
      expect(shown).toBeLessThanOrEqual(PHONE_SHOWN);
      expect(kept).toBeLessThanOrEqual(PHONE_KEPT);
    });
  }
  await test.step('Then more were fetched than it keeps, and it kept no more than 16', async () => {
    const fetched = tiles.filter((tile) => tile !== 'manifest.json');
    expect(fetched.length).toBeGreaterThan(PHONE_KEPT);
    const [, counted, kept] = await tileCounts(page);
    expect(counted).toBe(fetched.length);
    expect(kept).toBeLessThanOrEqual(PHONE_KEPT);
  });
  expect(problems).toEqual([]);
});

test('graphics that cannot hold the 4096 map get no tiles, and stop at 1.05 radii', async ({
  page,
}) => {
  test.slow();
  // Graphics that hold textures 2048 pixels wide at most, as the oldest phones' do.
  await page.addInitScript(() => {
    for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
      const get = Object.getOwnPropertyDescriptor(context.prototype, 'getParameter')?.value as (
        this: WebGLRenderingContext,
        name: number,
      ) => unknown;
      context.prototype.getParameter = function (this: WebGLRenderingContext, name: number) {
        return name === this.MAX_TEXTURE_SIZE ? 2048 : get.call(this, name);
      };
    }
  });
  const tiles = tileRequests(page);
  const canvas = page.getByTestId('globe').locator('canvas');
  await test.step('Given a link 50 km over the Nile', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&cam=30,31,1.008');
    await globeRendered(page);
  });
  await test.step('Then the camera comes no nearer than 1.05 radii, about 320 km up', async () => {
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},1\.050/);
  });
  await test.step('When they zoom in all the way', async () => {
    await canvas.hover();
    for (let step = 0; step < 20; step += 1) await page.mouse.wheel(0, -400);
  });
  await test.step('Then it stays at 1.05 radii, the zoom rail’s end, and no tile is fetched', async () => {
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},1\.050/);
    await expect(page.getByRole('slider', { name: 'Distance' })).toHaveValue('0');
    await expect(page.getByTestId('globe')).toHaveAttribute('data-earth-tiles', '0/0/0');
    expect(tiles).toEqual([]);
  });
});

test('the camera comes down to about 50 km above Earth, and no nearer the Moon than before', async ({
  page,
}) => {
  test.slow();
  const canvas = page.getByTestId('globe').locator('canvas');
  await test.step('Given Earth from 130 km up, they zoom in all the way', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&cam=30,31,1.02');
    await globeRendered(page);
    await canvas.hover();
    for (let step = 0; step < 30; step += 1) await page.mouse.wheel(0, -400);
  });
  await test.step('Then the camera stops 1.008 radii from the centre, about 50 km up', async () => {
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},1\.008/);
  });
  await test.step('Given the Moon close up, they zoom in all the way', async () => {
    await page.goto('./?t=2024-04-08T12:00Z&focus=moon&cam=0,0,1.2');
    await globeRendered(page);
    await canvas.hover();
    for (let step = 0; step < 30; step += 1) await page.mouse.wheel(0, -400);
  });
  await test.step('Then it stops at 1.05 Moon radii, as before', async () => {
    await expect(page).toHaveURL(/cam=-?\d+\.\d{4},-?\d+\.\d{4},1\.050&focus=moon/);
  });
});
