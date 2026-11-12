import { collectProblems, expect, globeRendered, GPU, test } from './support';

/**
 * Close up, Earth's full-size Blue Marble comes in tiles (#568): only those in view, and none at
 * the usual distance. Very close in, the 500 m map's tiles instead (#569), and only there.
 * Phones keep the 4096 map and fetch no tiles.
 */
test(
  'close up, Earth’s map comes in tiles, only those in view, the sharpest only very close in; from afar, none',
  GPU,
  async ({ page }, info) => {
    // The scene is heavy, and CI draws it in software.
    test.slow();
    const problems = collectProblems(page);
    const phone = info.project.name === 'mobile';
    const tiles: string[] = [];
    page.on('request', (request) => {
      const match = /\/textures\/earth-tiles\/(.+)$/.exec(request.url());
      if (match?.[1] !== undefined) tiles.push(match[1]);
    });
    const globe = page.getByTestId('globe');
    await test.step('Given Earth at the usual distance', async () => {
      await page.goto('./?t=2024-04-08T12:00Z');
      await globeRendered(page);
    });
    await test.step('Then no tile is fetched, nor their list', async () => {
      await expect(globe).toHaveAttribute('data-earth-tiles', '0/0');
      expect(tiles).toEqual([]);
    });
    await test.step('When they come down to 50 km over the Nile', async () => {
      await page.goto('./?t=2024-04-08T12:00Z&cam=30,31,1.008');
      await globeRendered(page);
      await expect(globe).toHaveAttribute('data-sharp', 'earth', { timeout: 30_000 });
    });
    await test.step('Then only the 500 m tile beneath is fetched and drawn, on a phone none', async () => {
      if (phone) {
        expect(tiles).toEqual([]);
        return;
      }
      await expect(globe).toHaveAttribute('data-earth-tiles', '1/1', { timeout: 30_000 });
      // 30° N 31° E: level 5's 38th tile east of 180° W and 11th south of the pole, 5.625° a side.
      expect(tiles).toEqual(['manifest.json', '5/37/10.webp']);
    });
    await test.step('When they rise to 1,900 km over the corner of four tiles', async () => {
      tiles.length = 0;
      await page.goto('./?t=2024-04-08T12:00Z&cam=22.5,22.5,1.3');
      await globeRendered(page);
    });
    await test.step('Then those four and their neighbours in view, and no others', async () => {
      if (phone) {
        expect(tiles).toEqual([]);
        return;
      }
      await expect(globe).toHaveAttribute('data-earth-tiles', /^([4-9]|1[0-6])\/\1$/, {
        timeout: 30_000,
      });
      const fetched = tiles.filter((tile) => tile !== 'manifest.json');
      // From this high, the full Blue Marble's tiles: none of the 500 m map's.
      expect(fetched.every((tile) => tile.startsWith('4/'))).toBe(true);
      expect(fetched).toEqual(
        expect.arrayContaining(['4/17/5.webp', '4/18/5.webp', '4/17/6.webp']),
      );
      expect(fetched).toContain('4/18/6.webp');
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
