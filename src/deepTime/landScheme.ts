/**
 * Land of unknown shape, for the ages before any reconstruction: a fixed field of noise on the
 * sphere, cut at the level that leaves a chosen share of the surface above it. The shapes and
 * places are invented; only the share comes from a source.
 */

import { valueAt } from '../util/arrays';

/** Columns and rows of the field, a whole longitude turn by pole to pole. */
export const LAND_NOISE_GRID = { columns: 512, rows: 256 } as const;

/** A hash of a lattice point to 0..1, the same on every run. */
function lattice(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ Math.imul(z, 0xcb1ab31f);
  h = Math.imul(h ^ seed ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 0x1_0000_0000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in three dimensions, 0..1, smooth between the lattice points. */
function valueNoise(x: number, y: number, z: number, seed: number): number {
  // Written out without helper closures: this runs 650 thousand times for one field.
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const fz = smooth(z - z0);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const z1 = z0 + 1;
  const a = lattice(x0, y0, z0, seed);
  const b = lattice(x1, y0, z0, seed);
  const c = lattice(x0, y1, z0, seed);
  const d = lattice(x1, y1, z0, seed);
  const e = lattice(x0, y0, z1, seed);
  const f = lattice(x1, y0, z1, seed);
  const g = lattice(x0, y1, z1, seed);
  const h = lattice(x1, y1, z1, seed);
  const near0 = a + (b - a) * fx;
  const near1 = c + (d - c) * fx;
  const far0 = e + (f - e) * fx;
  const far1 = g + (h - g) * fx;
  const near = near0 + (near1 - near0) * fy;
  const far = far0 + (far1 - far0) * fy;
  return near + (far - near) * fz;
}

/**
 * Bins for spreading the field's values by area: fine enough that two cells rarely share one,
 * so the bytes match an exact ranking but for a cell or two at a byte's edge.
 */
const SPREAD_BINS = 1 << 18;

/**
 * The field as bytes, row 0 at the south pole like the other masks, sampled on the unit sphere
 * so it has no seam at the date line and no pinch at the poles. Five octaves: broad blobs with
 * ragged coasts. Values are spread by area, each byte holding about 1/256 of the surface, so
 * any share can be cut to within a fraction of a percent.
 */
export function landNoise(columns: number, rows: number, seed = 1): Uint8Array {
  const raw = new Float64Array(columns * rows);
  const weights = new Float64Array(rows);
  for (let row = 0; row < rows; row++) {
    const latitude = ((row + 0.5) / rows - 0.5) * Math.PI;
    weights[row] = Math.cos(latitude);
    for (let column = 0; column < columns; column++) {
      const longitude = ((column + 0.5) / columns) * 2 * Math.PI;
      const x = Math.cos(latitude) * Math.cos(longitude);
      const y = Math.sin(latitude);
      const z = Math.cos(latitude) * Math.sin(longitude);
      let sum = 0;
      for (let octave = 0; octave < 5; octave++) {
        const frequency = 1.6 * 2 ** octave;
        sum +=
          0.5 ** octave * valueNoise(x * frequency, y * frequency, z * frequency, seed + octave);
      }
      raw[row * columns + column] = sum;
    }
  }
  // Spread by area without sorting: a weighted histogram of the values, then each cell takes the
  // share of the surface below its bin plus half its bin's own share.
  let low = Infinity;
  let high = -Infinity;
  for (const value of raw) {
    if (value < low) low = value;
    if (value > high) high = value;
  }
  const scale = (SPREAD_BINS - 1) / (high - low || 1);
  const binOf = new Uint32Array(raw.length);
  const binWeight = new Float64Array(SPREAD_BINS);
  let total = 0;
  for (let index = 0; index < raw.length; index++) {
    const bin = Math.floor((valueAt(raw, index) - low) * scale);
    const weight = valueAt(weights, Math.floor(index / columns));
    binOf[index] = bin;
    binWeight[bin] = valueAt(binWeight, bin) + weight;
    total += weight;
  }
  const middle = new Float64Array(SPREAD_BINS);
  let below = 0;
  for (let bin = 0; bin < SPREAD_BINS; bin++) {
    const weight = valueAt(binWeight, bin);
    middle[bin] = below + weight / 2;
    below += weight;
  }
  const bytes = new Uint8Array(columns * rows);
  for (let index = 0; index < raw.length; index++) {
    bytes[index] = Math.min(
      255,
      Math.floor((valueAt(middle, valueAt(binOf, index)) / total) * 256),
    );
  }
  return bytes;
}

/**
 * Share of the surface, by area, at each byte value: entry `v` is the share whose value is `v`
 * or more. Rows are weighted by the cosine of their latitude.
 */
export function shareAtOrAbove(field: Uint8Array, columns: number, rows: number): Float64Array {
  const byValue = new Float64Array(257);
  let total = 0;
  for (let row = 0; row < rows; row++) {
    const weight = Math.cos(((row + 0.5) / rows - 0.5) * Math.PI);
    for (let column = 0; column < columns; column++) {
      const value = valueAt(field, row * columns + column);
      byValue[value] = valueAt(byValue, value) + weight;
      total += weight;
    }
  }
  for (let value = 255; value >= 0; value--) {
    byValue[value] = valueAt(byValue, value) + valueAt(byValue, value + 1);
  }
  return byValue.map((area) => area / total);
}

/**
 * The cut, 0..1 as the shader reads a byte, above which `share` of the surface lies (the
 * nearest the bytes allow). A share of 0 or less is above every value: no land.
 */
export function levelForShare(shares: Float64Array, share: number): number {
  if (share <= 0) return 256 / 255;
  let best = 0;
  for (let value = 0; value <= 255; value++) {
    if (Math.abs(valueAt(shares, value) - share) < Math.abs(valueAt(shares, best) - share)) {
      best = value;
    }
  }
  // Halfway below the byte, so the shader's interpolated values cut cleanly.
  return (best - 0.5) / 255;
}
