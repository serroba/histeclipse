import { describe, expect, it } from 'vitest';

import { valueAt } from '../util/arrays';
import { landNoise, levelForShare, shareAtOrAbove } from './landScheme';

const columns = 128;
const rows = 64;
const field = landNoise(columns, rows);
const shares = shareAtOrAbove(field, columns, rows);

/** Area share of the field at or above a level, as the shader cuts it. */
function landShare(level: number): number {
  let land = 0;
  let total = 0;
  for (let row = 0; row < rows; row++) {
    const weight = Math.cos(((row + 0.5) / rows - 0.5) * Math.PI);
    for (let column = 0; column < columns; column++) {
      if (valueAt(field, row * columns + column) / 255 > level) land += weight;
      total += weight;
    }
  }
  return land / total;
}

describe('land of unknown shape', () => {
  it('is the same field on every run', () => {
    expect(landNoise(columns, rows)).toEqual(field);
    expect(landNoise(columns, rows, 2)).not.toEqual(field);
  });

  it('spreads its values widely, without seams at the date line', () => {
    expect(Math.min(...field)).toBeLessThan(80);
    expect(Math.max(...field)).toBeGreaterThan(175);
    for (let row = 0; row < rows; row++) {
      const first = valueAt(field, row * columns);
      const last = valueAt(field, row * columns + columns - 1);
      expect(Math.abs(first - last)).toBeLessThan(24);
    }
  });

  it('counts the whole surface at the lowest value and none above the highest', () => {
    expect(valueAt(shares, 0)).toBeCloseTo(1, 12);
    expect(valueAt(shares, 256)).toBe(0);
    for (let value = 1; value <= 256; value++) {
      expect(valueAt(shares, value)).toBeLessThanOrEqual(valueAt(shares, value - 1));
    }
  });

  it('cuts at the level that leaves the asked-for share as land', () => {
    for (const share of [0.01, 0.05, 0.12, 0.29]) {
      expect(landShare(levelForShare(shares, share))).toBeCloseTo(share, 2);
    }
  });

  it('draws no land for a share of nothing', () => {
    expect(levelForShare(shares, 0)).toBeGreaterThan(1);
    expect(landShare(levelForShare(shares, 0))).toBe(0);
  });
});
