import { describe, expect, it } from 'vitest';

import bce600 from '../../public/data/ohm/-600.json';
import index from '../../public/data/ohm/index.json';
import type { Fetch } from './fetchJson';
import { loadOhmCentury, loadOhmIndex, ohmIn } from './ohmBorders';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));

describe('OpenHistoricalMap borders', () => {
  it('are credited and cover antiquity to today', async () => {
    const loaded = await loadOhmIndex('/x', serve(index));
    expect(loaded.credit).toContain('OpenHistoricalMap');
    expect(loaded.centuries).toContain(-600);
    expect(loaded.centuries).toContain(1900);
  });

  it('give the borders and names of a year', async () => {
    const century = await loadOhmCentury('/x', serve(bce600));
    const year = ohmIn(century, -586);
    expect(year.borders.length).toBeGreaterThan(0);
    for (const line of year.borders) {
      for (const [lon, lat] of line) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
    expect(year.labels.length).toBeGreaterThan(0);
  });

  it('keep only what was in use that year', () => {
    const century = {
      schemaVersion: 1 as const,
      century: -600,
      scale: 100,
      borders: [
        { from: -600, to: -590, points: [100, 200, 300, 400] },
        { from: -580, to: -501, points: [0, 0, 100, 100] },
      ],
      labels: [{ name: 'Media', from: -600, to: -550, longitude: 50, latitude: 35 }],
    };
    expect(ohmIn(century, -595)).toEqual({
      borders: [
        [
          [1, 2],
          [3, 4],
        ],
      ],
      labels: [{ name: 'Media', latitude: 35, longitude: 50 }],
    });
    expect(ohmIn(century, -500)).toEqual({ borders: [], labels: [] });
  });

  it('reject points that are not lon/lat pairs', async () => {
    const broken = { ...bce600, borders: [{ from: 0, to: 1, points: [1, 2, 3] }] };
    await expect(loadOhmCentury('/x', serve(broken))).rejects.toThrow('lon/lat pairs');
  });
});
