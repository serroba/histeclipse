import { describe, expect, it } from 'vitest';

import { geoToVector } from './geo';
import {
  hitSphere,
  levelFor,
  tileAt,
  tileId,
  tileRect,
  tilesInView,
  viewRays,
  type TileCamera,
  type TileLevel,
} from './tileGrid';

/** The full Blue Marble: 32 by 16 tiles of 675 pixels. */
const FULL: TileLevel = { z: 4, columns: 32, rows: 16 };

/** A camera `distance` radii from the centre over a place, looking at the centre as the globe's does. */
function over(latitude: number, longitude: number, distance: number, aspect = 16 / 9): TileCamera {
  const eye = geoToVector({ latitude, longitude }, distance);
  return {
    eye,
    forward: [-eye[0], -eye[1], -eye[2]],
    // North on screen, unless straight over a pole.
    up: Math.abs(latitude) > 89 ? [1, 0, 0] : [0, 1, 0],
    verticalFovDegrees: 35,
    aspect,
  };
}

const ids = (camera: TileCamera, limit = 64): string[] =>
  tilesInView(FULL, camera, limit).map(tileId);

describe('Earth’s tiles', () => {
  it('number columns east from 180° W and rows south from the north pole', () => {
    expect(tileAt(FULL, geoToVector({ latitude: 89, longitude: -179 }))).toEqual({
      z: 4,
      x: 0,
      y: 0,
    });
    expect(tileAt(FULL, geoToVector({ latitude: -89, longitude: 179 }))).toEqual({
      z: 4,
      x: 31,
      y: 15,
    });
    // Greenwich on the equator: the first tile east of 0° and south of 0°.
    expect(tileAt(FULL, geoToVector({ latitude: -0.1, longitude: 0.1 }))).toEqual({
      z: 4,
      x: 16,
      y: 8,
    });
    // Cairo, 30° N 31° E: 11.25° a tile.
    expect(tileAt(FULL, geoToVector({ latitude: 30, longitude: 31 }))).toEqual({
      z: 4,
      x: 18,
      y: 5,
    });
    // The poles themselves fall in the first and last rows.
    expect(tileAt(FULL, [0, 1, 0]).y).toBe(0);
    expect(tileAt(FULL, [0, -1, 0]).y).toBe(15);
  });

  it('lie on the globe’s map where its texture coordinates put them', () => {
    expect(tileRect(FULL, { x: 0, y: 0 })).toEqual([0, 15 / 16, 1 / 32, 1 / 16]);
    expect(tileRect(FULL, { x: 31, y: 15 })).toEqual([31 / 32, 0, 1 / 32, 1 / 16]);
    expect(tileId({ z: 4, x: 18, y: 5 })).toBe('4/18/5');
  });

  it('are seen where a ray from the camera first meets the ground', () => {
    expect(hitSphere([0, 0, 3], [0, 0, -1])).toEqual([0, 0, 1]);
    // Past the limb, and looking away, nothing.
    expect(hitSphere([0, 0, 3], [0, 1, 0])).toBeNull();
    expect(hitSphere([0, 0, 3], [0, 0, 1])).toBeNull();
  });

  it('are sampled by rays spread across the whole screen', () => {
    const rays = viewRays(over(0, 0, 2), 4);
    expect(rays).toHaveLength(25);
    for (const ray of rays) expect(Math.hypot(...ray)).toBeCloseTo(1, 12);
    // The middle ray looks straight ahead; the corners as far out as the field of view.
    expect(rays[12]?.[0]).toBeCloseTo(-1, 12);
    const corner = rays[0] ?? [0, 0, 0];
    const half = Math.tan((35 * Math.PI) / 360);
    expect(Math.acos(-corner[0])).toBeCloseTo(Math.atan(half * Math.hypot(1, 16 / 9)), 12);
  });

  it('50 km above the Nile, only the tile beneath is fetched', () => {
    expect(ids(over(30, 31, 1.008))).toEqual(['4/18/5']);
  });

  it('on a tile’s corner, only the four tiles that meet there', () => {
    expect(ids(over(22.5, 22.5, 1.008)).sort()).toEqual(['4/17/5', '4/17/6', '4/18/5', '4/18/6']);
  });

  it('higher up, the tiles in view and no others: none behind the globe or past the edges', () => {
    const camera = over(30, 31, 1.4);
    const seen = tilesInView(FULL, camera, 64);
    // Nearest first: the one beneath.
    expect(seen[0]).toEqual({ z: 4, x: 18, y: 5 });
    expect(seen.length).toBeGreaterThan(4);
    expect(seen.length).toBeLessThan(40);
    for (const { x, y } of seen) {
      const longitude = -180 + (x + 0.5) * 11.25;
      const latitude = 90 - (y + 0.5) * 11.25;
      // Within some 40° of the point beneath: the view is less than 60° across.
      const centre = geoToVector({ latitude, longitude });
      const beneath = geoToVector({ latitude: 30, longitude: 31 });
      const angle = Math.acos(
        centre[0] * beneath[0] + centre[1] * beneath[1] + centre[2] * beneath[2],
      );
      expect((angle * 180) / Math.PI).toBeLessThan(40);
    }
    // The far side of the globe never.
    expect(seen.map(tileId)).not.toContain(
      tileId(tileAt(FULL, geoToVector({ latitude: -30, longitude: -149 }))),
    );
  });

  it('turning the camera away from the globe sees none', () => {
    const camera = over(30, 31, 1.2);
    const away: TileCamera = { ...camera, forward: camera.eye };
    expect(ids(away)).toEqual([]);
  });

  it('at most as many as asked, the nearest kept', () => {
    const camera = over(30, 31, 1.4);
    const all = tilesInView(FULL, camera, 64);
    expect(tilesInView(FULL, camera, 3)).toEqual(all.slice(0, 3));
  });

  it('over a pole, the tiles round it', () => {
    const seen = tilesInView(FULL, over(90, 0, 1.05), 64);
    expect(seen.length).toBeGreaterThan(8);
    expect(seen.every(({ y }) => y === 0)).toBe(true);
  });
});

describe('the level drawn', () => {
  const levels: TileLevel[] = [FULL, { z: 6, columns: 128, rows: 64 }];
  const pixel = (35 * Math.PI) / 180 / 1080;

  it('is the coarsest whose pixels are no larger on the ground than the screen’s', () => {
    // 6,400 km up, a screen pixel spans some 3.6 km: the full Blue Marble's 1.85 km will do.
    expect(levelFor(levels, 675, 1, pixel)).toBe(FULL);
    // 50 km up, 56 m: the finest there is.
    expect(levelFor(levels, 675, 0.008, pixel)?.z).toBe(6);
    expect(levelFor([FULL], 675, 0.008, pixel)).toBe(FULL);
    expect(levelFor([], 675, 0.008, pixel)).toBeNull();
  });
});
