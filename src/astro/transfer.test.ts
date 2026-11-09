import { describe, expect, it } from 'vitest';

import { GM_EARTH, GM_SUN, lambert, propagate, stumpff, type Vec3 } from './transfer';

const AU = 149_597_870.7;
const DAY = 86_400;
const UP: Vec3 = [0, 0, 1];

function apart(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('two-body orbits in universal variables', () => {
  it('Given z near 0 from either side, Then Stumpff’s functions meet at ½ and ⅙', () => {
    expect(stumpff(0)).toEqual([0.5, 1 / 6]);
    for (const z of [1e-4, -1e-4]) {
      const [c, s] = stumpff(z);
      expect(c).toBeCloseTo(0.5, 4);
      expect(s).toBeCloseTo(1 / 6, 4);
    }
  });

  it('Given a circular orbit at 1 AU, Then a quarter year carries a body a quarter turn', () => {
    const speed = Math.sqrt(GM_SUN / AU);
    const year = 2 * Math.PI * Math.sqrt(AU ** 3 / GM_SUN);
    const there = propagate([AU, 0, 0], [0, speed, 0], year / 4, GM_SUN);
    expect(apart(there, [0, AU, 0]) / AU).toBeLessThan(1e-9);
  });

  it('Given a hyperbola, Then propagating there and back returns the body', () => {
    const start: Vec3 = [7000, 0, 0];
    const fast: Vec3 = [0, 12, 1];
    const there = propagate(start, fast, 3 * 3600, GM_EARTH);
    // Back along the same orbit: its velocity there, reversed, is not to hand; propagate the
    // same orbit backwards in time instead.
    const back = propagate(there, velocityAt(start, fast, 3 * 3600), -3 * 3600, GM_EARTH);
    expect(apart(back, start)).toBeLessThan(1e-3);
  });

  it('Given two points on a circular orbit and the time between, Then Lambert finds the circle', () => {
    // A quarter turn at 1 AU, a quarter year apart.
    const year = 2 * Math.PI * Math.sqrt(AU ** 3 / GM_SUN);
    const found = lambert([AU, 0, 0], [0, AU, 0], year / 4, GM_SUN, UP);
    expect(found).not.toBeNull();
    const speed = Math.sqrt(GM_SUN / AU);
    expect(apart(found?.v1 ?? [0, 0, 0], [0, speed, 0]) / speed).toBeLessThan(1e-6);
  });

  it('Given Earth to Mars in 259 days, Then the transfer arrives where Mars is', () => {
    // Hohmann-like: from 1 AU to 1.524 AU, a little short of half a turn.
    const r1: Vec3 = [AU, 0, 0];
    const angle = (170 * Math.PI) / 180;
    const r2: Vec3 = [1.524 * AU * Math.cos(angle), 1.524 * AU * Math.sin(angle), 0];
    const found = lambert(r1, r2, 259 * DAY, GM_SUN, UP);
    expect(found).not.toBeNull();
    const arrived = propagate(r1, found?.v1 ?? [0, 0, 0], 259 * DAY, GM_SUN);
    expect(apart(arrived, r2) / AU).toBeLessThan(1e-6);
  });

  it('Given a transfer that must go round against the pole, Then it goes the long way, prograde', () => {
    // From +x to −y: the short way is clockwise; prograde about +z it goes three quarters round.
    const found = lambert([AU, 0, 0], [0, -AU, 0], 300 * DAY, GM_SUN, UP);
    expect(found?.v1[1] ?? 0).toBeGreaterThan(0);
  });

  it('Given points the same place, Then there is no transfer', () => {
    expect(lambert([AU, 0, 0], [AU, 0, 0], 100 * DAY, GM_SUN, UP)).toBeNull();
  });
});

/** The velocity after `seconds` along an orbit, by a small step either side. */
function velocityAt(r0: Vec3, v0: Vec3, seconds: number): Vec3 {
  const h = 1;
  const a = propagate(r0, v0, seconds - h, GM_EARTH);
  const b = propagate(r0, v0, seconds + h, GM_EARTH);
  return [(b[0] - a[0]) / (2 * h), (b[1] - a[1]) / (2 * h), (b[2] - a[2]) / (2 * h)];
}
