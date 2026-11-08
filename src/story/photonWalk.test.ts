import { describe, expect, it } from 'vitest';

import {
  BANDS,
  bandAt,
  ESCAPE_YEARS,
  photonWalk,
  RADIATIVE_EDGE,
  yearsAt,
  type Point,
} from './photonWalk';

const radius = ([x, y, z]: Point) => Math.hypot(x, y, z);
const start: Point = [-0.09, 0.01, 0.09];

describe("a photon's way out of the Sun", () => {
  const walk = photonWalk(start);

  it('walks out of the core through the radiative zone, then rises to the surface', () => {
    expect(walk.points[0]).toEqual(start);
    const lastWalked = walk.points[walk.convectionFrom - 1] ?? start;
    expect(radius(lastWalked)).toBeGreaterThanOrEqual(RADIATIVE_EDGE);
    expect(walk.convectionFrom).toBeGreaterThan(300);
    expect(radius(walk.points.at(-1) ?? start)).toBeCloseTo(1, 1);
  });

  it('is a random walk: it often steps back inward', () => {
    let inward = 0;
    for (let i = 1; i < walk.convectionFrom; i += 1) {
      if (radius(walk.points[i] ?? start) < radius(walk.points[i - 1] ?? start)) inward += 1;
    }
    expect(inward / walk.convectionFrom).toBeGreaterThan(0.3);
  });

  it('stays in the quarter the cut opens, so it is never hidden', () => {
    for (const [x, , z] of walk.points) {
      expect(x).toBeLessThanOrEqual(0);
      expect(z).toBeGreaterThanOrEqual(0);
    }
  });

  it('is the same walk every time', () => {
    expect(photonWalk(start).points).toEqual(walk.points);
  });

  it('softens from a gamma ray to X-rays, is carried by convection, and leaves as light', () => {
    expect(bandAt(walk, 0)).toBe('gamma');
    expect(bandAt(walk, 50)).toBe('xray');
    expect(bandAt(walk, walk.convectionFrom)).toBe('convection');
    expect(bandAt(walk, walk.points.length - 1)).toBe('visible');
    expect(BANDS.map(({ band }) => band)).toEqual(['gamma', 'xray', 'convection', 'visible']);
  });

  it('counts some 170,000 years across the radiative zone, and none more after', () => {
    expect(yearsAt(walk, 0)).toBe(0);
    expect(yearsAt(walk, walk.convectionFrom - 1)).toBe(ESCAPE_YEARS);
    expect(yearsAt(walk, walk.points.length - 1)).toBe(ESCAPE_YEARS);
    expect(BANDS[1]?.about).toContain('Mitalas & Sills 1992');
  });
});
