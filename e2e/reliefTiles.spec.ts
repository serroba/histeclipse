import type { Page } from '@playwright/test';

import { collectProblems, expect, globeRendered, GPU, test } from './support';

/**
 * Close up on the ice-age globe, today's heights come in tiles (#1016): only those in view, and
 * only there. Not at the usual distance, not on the older scales, not in the years.
 */

/** The relief tiles asked for, by path under their folder. */
function reliefRequests(page: Page): string[] {
  const tiles: string[] = [];
  page.on('request', (request) => {
    const match = /\/textures\/relief-tiles\/(.+)$/.exec(request.url());
    if (match?.[1] !== undefined) tiles.push(match[1]);
  });
  return tiles;
}

test(
  'close in on the ice-age globe, today’s heights come in tiles, only those in view; elsewhere none',
  GPU,
  async ({ page }) => {
    // The scene is heavy, and CI draws it in software.
    test.slow();
    const problems = collectProblems(page);
    const tiles = reliefRequests(page);
    const globe = page.getByTestId('globe');
    await test.step('Given the Last Glacial Maximum at the usual distance', async () => {
      await page.goto('./?ma=0.021&scale=ice');
      await globeRendered(page);
      await expect(globe).toHaveAttribute('data-shelf', /shelf/, { timeout: 30_000 });
    });
    await test.step('Then no relief tile is drawn or fetched', async () => {
      await expect(globe).toHaveAttribute('data-relief-tiles', '0/0/0');
      expect(tiles.filter((tile) => tile !== 'manifest.json')).toEqual([]);
    });
    await test.step('When they come down over the Sunda Shelf, laid bare', async () => {
      await page.goto('./?ma=0.021&scale=ice&cam=2,108,1.1');
      await globeRendered(page);
    });
    await test.step('Then the tiles beneath are fetched and drawn, and only near there', async () => {
      await expect(globe).toHaveAttribute('data-relief-tiles', /^([1-9]\d*)\/\d+\/\d+$/, {
        timeout: 30_000,
      });
      const fetched = tiles.filter((tile) => tile !== 'manifest.json');
      expect(fetched.length).toBeGreaterThan(0);
      for (const tile of fetched) {
        const [z = -1, x = -1, y = -1] = tile.split(/[/.]/).map(Number);
        // 2° N 108° E: level 3's tile 12 (from 101.25° E), row 3 or 4 (either side of the
        // equator); level 2's tile 6, row 1 or 2. The view reaches a tile or two round it.
        const across = 2 ** (z + 1);
        const east = Math.floor(((108 + 180) / 360) * across);
        expect(Math.abs(x - east)).toBeLessThanOrEqual(2);
        expect(Math.abs(y - 2 ** z / 2)).toBeLessThanOrEqual(2);
      }
      // The Blue Marble's are not drawn in deep time.
      await expect(globe).toHaveAttribute('data-earth-tiles', /^0\//);
    });
    await test.step('When they go to the 540 Myr scale over the same place', async () => {
      tiles.length = 0;
      await page.goto('./?ma=100&scale=all&cam=2,108,1.1');
      await globeRendered(page);
    });
    await test.step('Then none: another age’s ground is not today’s', async () => {
      await expect(globe).toHaveAttribute('data-relief-tiles', /^0\//);
      expect(tiles.filter((tile) => tile !== 'manifest.json')).toEqual([]);
    });
    expect(problems).toEqual([]);
  },
);
