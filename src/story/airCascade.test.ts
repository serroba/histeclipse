import { describe, expect, it } from 'vitest';

import {
  airCascade,
  altitudeAt,
  depthAt,
  FIRST_COLLISION_KM,
  MADE_KM,
  microseconds,
  PARTICLES,
  pieces,
  reached,
  SEA_LEVEL_DEPTH,
  SHOWER_FACTS,
  TOP_KM,
} from './airCascade';

describe('the air', () => {
  it('is all above sea level, and thins by e every scale height', () => {
    expect(depthAt(0)).toBe(SEA_LEVEL_DEPTH);
    expect(depthAt(7)).toBeCloseTo(SEA_LEVEL_DEPTH / Math.E, 6);
    expect(altitudeAt(depthAt(12.5))).toBeCloseTo(12.5, 9);
  });

  it('puts the first collision about 17 km up, some 57 µs of light above the ground', () => {
    expect(FIRST_COLLISION_KM).toBeCloseTo(17.1, 1);
    expect(microseconds(FIRST_COLLISION_KM)).toBeCloseTo(57, 0);
  });
});

describe('airCascade', () => {
  const cascade = airCascade();

  it('is the same shower every time', () => {
    expect(airCascade()).toEqual(cascade);
    expect(airCascade(12)).not.toEqual(cascade);
  });

  it('starts with the proton coming in from the top to the first collision', () => {
    const [proton] = cascade.tracks;
    expect(proton?.kind).toBe('proton');
    expect(proton?.from[1]).toBeCloseTo(TOP_KM, 9);
    expect(proton?.to).toEqual(cascade.first);
    expect(proton?.end).toBe(0);
    expect(cascade.first[1]).toBeCloseTo(FIRST_COLLISION_KM, 9);
  });

  it('strikes again nearer each time, as the air thickens', () => {
    const heights = cascade.collisions.map(([, y]) => y);
    expect(heights).toHaveLength(4);
    const gaps = heights.slice(1).map((y, i) => (heights[i] ?? 0) - y);
    for (const [i, gap] of gaps.entries()) {
      expect(gap).toBeGreaterThan(0);
      if (i > 0) expect(gap).toBeLessThan(gaps[i - 1] ?? 0);
    }
  });

  it('keeps every track between the ground and the top, starting before it ends', () => {
    for (const { from, to, start, end } of cascade.tracks) {
      for (const [, y] of [from, to]) {
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(TOP_KM + 1e-9);
      }
      expect(end).toBeGreaterThan(start);
    }
    expect(cascade.length).toBe(Math.max(...cascade.tracks.map(({ end }) => end)));
  });

  it('draws every kind the legend names, and a modest number of tracks', () => {
    const kinds = new Set(cascade.tracks.map(({ kind }) => kind));
    expect([...kinds].sort()).toEqual(PARTICLES.map(({ kind }) => kind).sort());
    expect(cascade.tracks.length).toBeGreaterThan(60);
    expect(cascade.tracks.length).toBeLessThan(200);
  });

  it('sends muons to the ground', () => {
    const muons = cascade.tracks.filter(({ kind }) => kind === 'muon');
    expect(muons.length).toBeGreaterThan(0);
    for (const { to } of muons) expect(to[1]).toBeCloseTo(0, 9);
  });

  it('follows a neutron from a collision where carbon-14 is made', () => {
    const [born] = cascade.neutron;
    expect(cascade.neutron.length).toBeGreaterThan(10);
    expect(cascade.collisions).toContainEqual(born);
    expect(born?.[1]).toBeGreaterThanOrEqual(MADE_KM[0]);
    expect(born?.[1]).toBeLessThanOrEqual(MADE_KM[1]);
  });
});

describe('pieces', () => {
  const cascade = airCascade();
  const drawn = pieces(cascade.tracks);

  it('cuts the tracks into short pieces in the order the front reaches them', () => {
    expect(drawn.length).toBeGreaterThan(cascade.tracks.length);
    for (const [i, piece] of drawn.entries()) {
      if (i > 0) expect(piece.at).toBeGreaterThanOrEqual(drawn[i - 1]?.at ?? 0);
      expect(Math.hypot(...piece.to.map((v, k) => v - (piece.from[k] ?? 0)))).toBeLessThanOrEqual(
        0.25 + 1e-9,
      );
    }
  });

  it('counts what the front has reached', () => {
    expect(reached(drawn, -Infinity)).toBe(0);
    expect(reached(drawn, Infinity)).toBe(drawn.length);
    const half = reached(drawn, cascade.length / 2);
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(drawn.length);
    expect(drawn[half - 1]?.at).toBeLessThanOrEqual(cascade.length / 2);
    expect(drawn[half]?.at).toBeGreaterThan(cascade.length / 2);
  });
});

describe('SHOWER_FACTS', () => {
  it('says the numbers the shower is drawn by', () => {
    expect(SHOWER_FACTS).toEqual([
      'First collision about 17 km up, after one interaction length of air, 90.1 g/cm²',
      'Its front reaches the ground some 57 µs later, at nearly the speed of light',
      'Most carbon-14 is made 9–15 km up',
      'Only a few of its particles drawn',
    ]);
  });
});
