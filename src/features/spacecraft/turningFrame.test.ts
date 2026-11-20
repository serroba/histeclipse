import { describe, expect, it } from 'vitest';

import type { Vec3 } from '../../astro/transfer';
import { heldToSun, lPointAt, lPointMark, lPointRoute } from './turningFrame';

const OBLIQUITY = (84_381.406 / 3600) * (Math.PI / 180);
const AU = 149_597_870.7;

/** A direction in the ecliptic at `degrees` of longitude, J2000 equatorial, `r` long. */
function onEcliptic(degrees: number, r: number, above = 0): Vec3 {
  const l = (degrees * Math.PI) / 180;
  const [x, y, z] = [r * Math.cos(l), r * Math.sin(l), above];
  return [
    x,
    y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY),
    y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY),
  ];
}

function expectNear(actual: Vec3, expected: Vec3, km: number): void {
  const off = Math.hypot(actual[0] - expected[0], actual[1] - expected[1], actual[2] - expected[2]);
  expect(off).toBeLessThan(km);
}

describe('the Sun–Earth turning frame (#995)', () => {
  it('Given a craft at L2 all year, Then held to the Sun it stays at the one point', () => {
    const sunNow = onEcliptic(128, AU);
    const l2Now = lPointAt('SEL2', sunNow);
    for (const days of [0, 60, 150, 240, 330]) {
      const sunThen = onEcliptic(128 - (days * 360) / 365.25, AU);
      expectNear(heldToSun(lPointAt('SEL2', sunThen), sunThen, sunNow), l2Now, 1);
    }
  });

  it('Given a point above the ecliptic, Then it keeps its height as it turns', () => {
    const point = onEcliptic(10, 1_400_000, 400_000);
    const moved = heldToSun(point, onEcliptic(0, AU), onEcliptic(90, AU));
    expectNear(moved, onEcliptic(100, 1_400_000, 400_000), 1);
  });

  it('Given the moment shown, Then nothing turns', () => {
    const sun = onEcliptic(200, AU);
    expectNear(heldToSun([1, 2, 3], sun, sun), [1, 2, 3], 1e-9);
  });

  it('Then L1 is 1.5 million km sunward and L2 as far away from the Sun', () => {
    const sun = onEcliptic(40, AU);
    expectNear(lPointAt('SEL1', sun), onEcliptic(40, 1_500_000), 1);
    expectNear(lPointAt('SEL2', sun), onEcliptic(220, 1_500_000), 1);
  });

  it('Then the mark is three short lines crossing at the point', () => {
    const mark = lPointMark([1_500_000, 0, 0]);
    expect(mark).toHaveLength(8);
    expect(mark.filter((point) => point === null)).toHaveLength(2);
    expect(mark[0]).toEqual([1_440_000, 0, 0]);
    expect(mark[1]).toEqual([1_560_000, 0, 0]);
  });

  it('Then a mission to L2 has its mark as a route, and one to no L point none', () => {
    const sun = onEcliptic(0, AU);
    expect(lPointRoute(null, sun)).toEqual([]);
    const [mark] = lPointRoute('SEL2', sun);
    expect(mark?.id).toBe('SEL2');
    expect(mark?.points[0]?.[0]).toBeCloseTo(-1_560_000, 0);
  });
});
