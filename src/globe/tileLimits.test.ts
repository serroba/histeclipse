import { beforeAll, describe, expect, it } from 'vitest';

import manifest from '../../public/textures/earth-tiles/manifest.json' with { type: 'json' };
import { loadEarthTiles, type EarthTiles } from '../data/earthTiles';
import { wantedTiles } from './earthTiles';
import { geoToVector } from './geo';
import { tileAt, tileId, type TileCamera } from './tileGrid';
import { DESKTOP_TILES, PHONE_TILES, tileLimits, TILES_NEED_TEXTURE } from './tileLimits';

let TILES: EarthTiles;
beforeAll(async () => {
  TILES = await loadEarthTiles('/x', () => Promise.resolve(Response.json(manifest)));
});

/** A screen, in CSS pixels, drawn at twice that in device pixels as the scene caps it. */
interface Screen {
  readonly width: number;
  readonly height: number;
}
const PIXEL_7: Screen = { width: 412, height: 839 };
const IPHONE: Screen = { width: 390, height: 664 };
const LAPTOP: Screen = { width: 1280, height: 720 };

/** The scene's camera over a place: 40° across the narrower side, north up. */
function over(latitude: number, longitude: number, distance: number, screen: Screen): TileCamera {
  const eye = geoToVector({ latitude, longitude }, distance);
  const aspect = screen.width / screen.height;
  const half = (20 * Math.PI) / 180;
  const vertical = aspect >= 1 ? 2 * half : 2 * Math.atan(Math.tan(half) / aspect);
  return {
    eye,
    forward: [-eye[0], -eye[1], -eye[2]],
    up: [0, 1, 0],
    verticalFovDegrees: (vertical * 180) / Math.PI,
    aspect,
  };
}

const wanted = (camera: TileCamera, screen: Screen, limits = PHONE_TILES): string[] | null =>
  wantedTiles(TILES, camera, screen.height * 2, limits)?.keys.map(tileId) ?? null;

/** A tile's GPU memory, bytes: RGBA with its mipmaps, a third more. */
const TILE_BYTES = (675 * 675 * 4 * 4) / 3;

describe('what a device takes on of Earth’s tiles', () => {
  it('gives tiles to graphics that hold the 4096 map, a phone’s smaller budget to a touch screen', () => {
    expect(tileLimits(16_384, false)).toBe(DESKTOP_TILES);
    expect(tileLimits(16_384, true)).toBe(PHONE_TILES);
    expect(tileLimits(TILES_NEED_TEXTURE, true)).toBe(PHONE_TILES);
    expect(tileLimits(TILES_NEED_TEXTURE - 1, true)).toBeNull();
    expect(tileLimits(2048, false)).toBeNull();
  });

  it('keeps a phone’s tiles to some 40 MB of graphics memory, under the 8192 map it never takes', () => {
    expect(PHONE_TILES.kept * TILE_BYTES).toBeLessThan(40e6);
    expect(DESKTOP_TILES.kept * TILE_BYTES).toBeLessThan(120e6);
    // The 8192 map, which phones skip: 8192 × 4096, with mipmaps.
    expect(PHONE_TILES.kept * TILE_BYTES).toBeLessThan((8192 * 4096 * 4 * 4) / 3 / 4);
  });

  it('draws no more than a phone keeps, and fetches fewer at once than a computer', () => {
    for (const limits of [PHONE_TILES, DESKTOP_TILES]) {
      expect(limits.shown).toBeLessThanOrEqual(limits.kept);
      expect(limits.loading).toBeLessThanOrEqual(limits.shown);
    }
    expect(PHONE_TILES.kept).toBeLessThan(DESKTOP_TILES.kept);
    expect(PHONE_TILES.loading).toBeLessThan(DESKTOP_TILES.loading);
    expect(PHONE_TILES.within).toBeLessThan(DESKTOP_TILES.within);
  });
});

describe('the tiles a phone asks for', () => {
  it('none from farther than 1.3 radii, where a computer still takes them', () => {
    for (const screen of [PIXEL_7, IPHONE]) {
      expect(wanted(over(-43.5, 170.5, 1.35, screen), screen)).toBeNull();
      expect(wanted(over(-43.5, 170.5, 4.5, screen), screen)).toBeNull();
    }
    expect(wanted(over(-43.5, 170.5, 1.35, LAPTOP), LAPTOP, DESKTOP_TILES)?.length).toBeGreaterThan(
      0,
    );
  });

  it('only the 500 m tile beneath, 50 km over New Zealand’s South Island', () => {
    // 43.5° S 170.5° E: level 5's 63rd tile east of 180° W and 24th south of the pole.
    expect(wanted(over(-43.5, 170.5, 1.008, PIXEL_7), PIXEL_7)).toEqual(['5/62/23']);
  });

  it('the full Blue Marble’s tiles from high up, the 500 m map’s from nearer in', () => {
    const levels = [1.29, 1.2, 1.1, 1.05].map(
      (distance) =>
        wantedTiles(TILES, over(-43.5, 170.5, distance, PIXEL_7), 1678, PHONE_TILES)?.level.z,
    );
    expect(levels[0]).toBe(4);
    expect(levels.at(-1)).toBe(5);
  });

  it('at most as many as it draws, wherever it looks from within reach', () => {
    for (const screen of [PIXEL_7, IPHONE]) {
      for (const distance of [1.008, 1.05, 1.1, 1.2, 1.29]) {
        for (const [latitude, longitude] of [
          [-43.5, 170.5],
          [30, 31],
          [0, 0],
          [70, -40],
        ] as const) {
          const tiles = wanted(over(latitude, longitude, distance, screen), screen) ?? [];
          expect(tiles.length).toBeGreaterThan(0);
          expect(tiles.length).toBeLessThanOrEqual(PHONE_TILES.shown);
        }
      }
    }
  });

  it('the nearest first, when there are more in view than it draws', () => {
    const camera = over(5, 5, 1.29, PIXEL_7);
    const phone = wanted(camera, PIXEL_7) ?? [];
    const all = wanted(camera, PIXEL_7, { ...PHONE_TILES, shown: 64 }) ?? [];
    expect(all.length).toBeGreaterThanOrEqual(phone.length);
    expect(all.slice(0, phone.length)).toEqual(phone);
    // Straight below first.
    const level = wantedTiles(TILES, camera, PIXEL_7.height * 2, PHONE_TILES)?.level;
    if (level === undefined) throw new Error('no level');
    expect(phone[0]).toBe(tileId(tileAt(level, geoToVector({ latitude: 5, longitude: 5 }))));
  });
});
