import { beforeAll, describe, expect, it } from 'vitest';

import manifest from '../../public/textures/earth-tiles/manifest.json' with { type: 'json' };
import { loadEarthTiles, type EarthTiles } from '../data/earthTiles';
import { drawPlan, wantedTiles } from './earthTiles';
import { DESKTOP_TILES } from './tileLimits';
import { geoToVector } from './geo';
import { tileId, type TileCamera, type TileKey } from './tileGrid';

let served: EarthTiles;
beforeAll(async () => {
  served = await loadEarthTiles('/x', () => Promise.resolve(Response.json(manifest)));
});

/** Straight down from `distance` radii over a place, north up, as the globe looks. */
function over(latitude: number, longitude: number, distance: number): TileCamera {
  const eye = geoToVector({ latitude, longitude }, distance);
  return {
    eye,
    forward: [-eye[0], -eye[1], -eye[2]],
    up: [0, 1, 0],
    verticalFovDegrees: 40,
    aspect: 16 / 9,
  };
}

/** A laptop's screen, 1,440 device pixels tall. */
const PIXELS = 1440;

describe('the level of Earth’s tiles drawn', () => {
  it('is none from afar: the default view fetches nothing', () => {
    expect(wantedTiles(served, over(30, 31, 3), PIXELS, DESKTOP_TILES)).toBeNull();
    expect(wantedTiles(served, over(30, 31, 1.6), PIXELS, DESKTOP_TILES)).toBeNull();
  });

  it('is the full Blue Marble (level 4) down to some 900 km up', () => {
    for (const distance of [1.5, 1.3, 1.16]) {
      const wanted = wantedTiles(served, over(30, 31, distance), PIXELS, DESKTOP_TILES);
      expect(wanted?.level.z).toBe(4);
      expect(wanted?.coarser).toBeNull();
    }
  });

  it('is the 500 m map (level 5) closer in, over level 4 until each tile arrives', () => {
    for (const distance of [1.14, 1.05, 1.008]) {
      const wanted = wantedTiles(served, over(30, 31, distance), PIXELS, DESKTOP_TILES);
      expect(wanted?.level.z).toBe(5);
      expect(wanted?.coarser?.z).toBe(4);
    }
    // 50 km over the Nile: the one tile beneath, 5.625° a side.
    const nile = wantedTiles(served, over(30, 31, 1.008), PIXELS, DESKTOP_TILES);
    expect(nile?.keys.map(tileId)).toEqual(['5/37/10']);
  });

  it('turns to level 5 farther out on a sharper screen, nearer on a coarser one', () => {
    expect(wantedTiles(served, over(30, 31, 1.2), 2160, DESKTOP_TILES)?.level.z).toBe(5);
    expect(wantedTiles(served, over(30, 31, 1.1), 720, DESKTOP_TILES)?.level.z).toBe(4);
  });

  it('asks for few enough level 5 tiles to draw them all where it turns to them', () => {
    const wanted = wantedTiles(served, over(45, 10, 1.14), PIXELS, DESKTOP_TILES);
    expect(wanted?.keys.length).toBeGreaterThan(4);
    expect(wanted?.keys.length).toBeLessThan(32);
  });
});

describe('what is drawn while level 5 arrives', () => {
  const near = (): ReturnType<typeof wantedTiles> =>
    wantedTiles(served, over(50.6, 5.6, 1.03), PIXELS, DESKTOP_TILES);
  const keys = (list: readonly TileKey[]): string[] => list.map(tileId).sort();

  it('is level 4 beneath the level 5 tiles not yet arrived, if it has arrived itself', () => {
    const wanted = near();
    const arrived = new Set(['4/16/3']);
    const plan = drawPlan(wanted, (key) => arrived.has(tileId(key)), new Set());
    // Over the corner of four level 5 tiles, all in the one level 4 tile.
    expect(keys(wanted?.keys ?? [])).toEqual(['5/32/6', '5/32/7', '5/33/6', '5/33/7']);
    expect(keys(plan.beneath)).toEqual(['4/16/3']);
    expect(plan.tiles.map(({ key }) => key)).toEqual(wanted?.keys);
    expect(plan.tiles.every(({ over }) => over)).toBe(true);
  });

  it('is nothing beneath once level 5 has arrived, which then shows at once if level 4 was drawn', () => {
    const plan = drawPlan(near(), () => true, new Set(['4/16/3']));
    expect(plan.beneath).toEqual([]);
    expect(plan.tiles.every(({ over }) => over)).toBe(true);
    const fresh = drawPlan(near(), () => true, new Set());
    expect(fresh.tiles.some(({ over }) => over)).toBe(false);
  });

  it('is never a level 4 tile not yet fetched, nor anything beneath level 4', () => {
    expect(drawPlan(near(), () => false, new Set()).beneath).toEqual([]);
    const far = wantedTiles(served, over(45, 10, 1.3), PIXELS, DESKTOP_TILES);
    expect(drawPlan(far, () => false, new Set(['3/0/0'])).beneath).toEqual([]);
    expect(drawPlan(null, () => true, new Set())).toEqual({ beneath: [], tiles: [] });
  });
});
