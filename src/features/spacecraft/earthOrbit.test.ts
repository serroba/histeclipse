import { describe, expect, it } from 'vitest';

import { circling, lapDays, orbitRadiusKm, planeDriftDegPerDay } from './earthOrbit';

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

  it('Given any moment, Then it is on its circle, never further from the equator than its tilt', () => {
    const radius = orbitRadiusKm(HUBBLE);
    let highest = 0;
    for (let k = 0; k < 500; k += 1) {
      const at = circling(HUBBLE, J2000 - 3000 + k * 0.0137);
      expect(Math.hypot(...at)).toBeCloseTo(radius, 6);
      highest = Math.max(highest, Math.abs(Math.asin(at[2] / radius)));
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

  it('Given J2000, Then it starts over the equator at the equinox, heading north', () => {
    const start = circling(HUBBLE, J2000);
    expect(start[0]).toBeCloseTo(orbitRadiusKm(HUBBLE), 6);
    expect(start[2]).toBeCloseTo(0, 6);
    expect(circling(HUBBLE, J2000 + 0.001)[2]).toBeGreaterThan(0);
  });
});
