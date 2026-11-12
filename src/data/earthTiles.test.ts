import { describe, expect, it } from 'vitest';

import served from '../../public/textures/earth-tiles/manifest.json' with { type: 'json' };
import type { Fetch } from '../util/fetchJson';
import { loadEarthTiles, tilePath } from './earthTiles';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

const [full] = served.levels;

describe('the manifest of Earth’s tiles', () => {
  it('lists the full Blue Marble as level 4 and the 500 m map as level 5, in 675-pixel tiles', async () => {
    const tiles = await loadEarthTiles('/textures/earth-tiles/manifest.json', serve(served));
    expect(tiles.tileSize).toBe(675);
    expect(tiles.levels.map(({ z, columns, rows }) => ({ z, columns, rows }))).toEqual([
      { z: 4, columns: 32, rows: 16 },
      { z: 5, columns: 64, rows: 32 },
    ]);
    // Cut from the same pinned release as the sharp map, so credited as it is.
    expect(tiles.levels[0]?.sources.map(({ url }) => url)).toEqual([
      expect.stringMatching(/world\.topo\.bathy\.200404\.3x21600x10800\.jpg$/),
    ]);
    // Level 5 from the same month at 500 m, NASA's eight tiles of 90°.
    const names = tiles.levels[1]?.sources.map(({ url }) => /\.(\w\d)\.jpg$/.exec(url)?.[1]);
    expect(names).toEqual(['A1', 'B1', 'C1', 'D1', 'A2', 'B2', 'C2', 'D2']);
    expect(tilePath(tiles, 4, 18, 5)).toBe('4/18/5.webp');
  });

  it('rejects a level of the wrong shape', async () => {
    const skewed = { ...served, levels: [{ ...full, columns: 30 }] };
    await expect(loadEarthTiles('/x', serve(skewed))).rejects.toThrow('2^(z+1)');
  });

  it('rejects a level cut from no map', async () => {
    const unsourced = { ...served, levels: [{ ...full, sources: [] }] };
    await expect(loadEarthTiles('/x', serve(unsourced))).rejects.toThrow();
  });

  it('rejects levels out of order', async () => {
    const deeper = { ...full, z: 5, columns: 64, rows: 32 };
    const backwards = { ...served, levels: [deeper, full] };
    await expect(loadEarthTiles('/x', serve(backwards))).rejects.toThrow('coarsest first');
    const ordered = await loadEarthTiles('/x', serve({ ...served, levels: [full, deeper] }));
    expect(ordered.levels.map(({ z }) => z)).toEqual([4, 5]);
  });

  it('rejects tiles anywhere but beside the manifest', async () => {
    await expect(
      loadEarthTiles('/x', serve({ ...served, path: '../../{z}/{x}/{y}.webp' })),
    ).rejects.toThrow();
  });
});
