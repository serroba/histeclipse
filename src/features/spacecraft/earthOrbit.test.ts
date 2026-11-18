import { describe, expect, it } from 'vitest';

import {
  circling,
  eccentricAnomaly,
  eccentricity,
  lapMoments,
  lapDays,
  orbitRadiusKm,
  planeDriftDegPerDay,
} from './earthOrbit';

/** Hubble's orbit as GCAT gives it for May 1990. */
const HUBBLE = { perigeeKm: 611, apogeeKm: 620, inclinationDeg: 28.47 };
const J2000 = 2_451_545;

describe('a craft in orbit about Earth (#795)', () => {
  it('Given Hubble’s heights, Then its circle is some 615 km up, gone round in about 97 minutes', () => {
    expect(orbitRadiusKm(HUBBLE)).toBeCloseTo(6378.137 + 615.5, 6);
    expect(lapDays(HUBBLE) * 1440).toBeCloseTo(97, 0);
  });

  it('Given its tilt, Then its plane swings westward some six degrees a day', () => {
    expect(planeDriftDegPerDay(HUBBLE)).toBeCloseTo(-6.3, 1);
    // Over the poles, Earth's bulge does not swing the plane.
    expect(planeDriftDegPerDay({ ...HUBBLE, inclinationDeg: 90 })).toBeCloseTo(0, 9);
  });

  it('Given any moment, Then it is between its lowest and highest, never further from the equator than its tilt', () => {
    let highest = 0;
    for (let k = 0; k < 500; k += 1) {
      const at = circling(HUBBLE, J2000 - 3000 + k * 0.0137);
      const distance = Math.hypot(...at);
      expect(distance).toBeGreaterThan(6378.137 + 611 - 1e-6);
      expect(distance).toBeLessThan(6378.137 + 620 + 1e-6);
      highest = Math.max(highest, Math.abs(Math.asin(at[2] / distance)));
    }
    expect((highest * 180) / Math.PI).toBeCloseTo(28.47, 1);
  });

  it('Given a lap later, Then it is back where it was, but for the swing of its plane', () => {
    const lap = lapDays(HUBBLE);
    const before = circling(HUBBLE, J2000 + 100);
    const after = circling(HUBBLE, J2000 + 100 + lap);
    const apart = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    // A lap's swing of the plane: under half a degree, some 50 km at its height.
    expect(apart).toBeLessThan(60);
    const half = circling(HUBBLE, J2000 + 100 + lap / 2);
    expect(Math.hypot(half[0] + before[0], half[1] + before[1], half[2] + before[2])).toBeLessThan(
      60,
    );
  });

  it('Given J2000, Then it starts at its lowest, over the equator at the equinox, heading north', () => {
    const start = circling(HUBBLE, J2000);
    expect(start[0]).toBeCloseTo(6378.137 + 611, 6);
    expect(start[2]).toBeCloseTo(0, 6);
    expect(circling(HUBBLE, J2000 + 0.001)[2]).toBeGreaterThan(0);
  });
});

/** Chandra's orbit as GCAT gives it for August 1999 (#849). */
const CHANDRA = { perigeeKm: 9999, apogeeKm: 138_826, inclinationDeg: 28.56 };

describe('a long ellipse about Earth: Chandra (#849)', () => {
  it('Given its heights, Then it is long and thin, gone round in about 64 hours', () => {
    expect(eccentricity(CHANDRA)).toBeCloseTo(0.797, 3);
    expect(eccentricity(HUBBLE)).toBeLessThan(0.001);
    // 63.5 hours for its orbit as first measured; about 64 now.
    expect(lapDays(CHANDRA) * 24).toBeGreaterThan(63);
    expect(lapDays(CHANDRA) * 24).toBeLessThan(65);
  });

  it('Given a lap, Then it reaches its highest half a lap after its lowest, and goes fastest near Earth', () => {
    const lap = lapDays(CHANDRA);
    const distance = (days: number): number => Math.hypot(...circling(CHANDRA, J2000 + days));
    expect(distance(0)).toBeCloseTo(6378.137 + 9999, 3);
    expect(distance(lap / 2)).toBeCloseTo(6378.137 + 138_826, 3);
    // A tenth of a lap from its lowest it has gone far round; from its highest, hardly at all.
    const turned = (from: number): number => {
      const [a, b] = [circling(CHANDRA, J2000 + from), circling(CHANDRA, J2000 + from + lap / 10)];
      const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      return Math.acos(dot / (Math.hypot(...a) * Math.hypot(...b)));
    };
    expect(turned(-lap / 20)).toBeGreaterThan(5 * turned(lap / 2 - lap / 20));
  });

  it('Given Kepler’s equation, Then its solution satisfies it, even for a long ellipse', () => {
    for (const e of [0, 0.3, 0.78, 0.95]) {
      for (const mean of [0.01, 1, 3, 6]) {
        const anomaly = eccentricAnomaly(mean, e);
        expect(anomaly - e * Math.sin(anomaly)).toBeCloseTo(mean, 10);
      }
    }
  });

  it('Given a moment before J2000, Then it is still on its ellipse', () => {
    const at = Math.hypot(...circling(CHANDRA, J2000 - 1000.37));
    expect(at).toBeGreaterThan(6378.137 + 9999 - 1e-6);
    expect(at).toBeLessThan(6378.137 + 138_826 + 1e-6);
  });
});

describe('the lap just made, as a ring (#849)', () => {
  it('Given a circle, Then its moments are evenly spaced in time, a lap back', () => {
    const moments = lapMoments(HUBBLE, J2000 + 10.3, 5);
    const lap = lapDays(HUBBLE);
    expect(moments[0]).toBeCloseTo(J2000 + 10.3, 9);
    expect(moments[4]).toBeCloseTo(J2000 + 10.3 - lap, 9);
    expect((moments[0] ?? 0) - (moments[1] ?? 0)).toBeCloseTo(lap / 4, 3);
  });

  it('Given a long ellipse, Then its moments crowd where it goes fast, near Earth, but still span a lap', () => {
    const moments = lapMoments(CHANDRA, J2000 + 0.5, 61);
    const lap = lapDays(CHANDRA);
    expect(moments[0]).toBeCloseTo(J2000 + 0.5, 9);
    expect(moments[60]).toBeCloseTo(J2000 + 0.5 - lap, 6);
    const gaps = moments.slice(1).map((moment, step) => (moments[step] ?? 0) - moment);
    for (const gap of gaps) expect(gap).toBeGreaterThan(0);
    // About (1 + e) / (1 − e), some 9 for Chandra.
    expect(Math.max(...gaps) / Math.min(...gaps)).toBeGreaterThan(5);
  });
});
