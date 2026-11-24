import { describe, expect, it } from 'vitest';

import { CAVITY_KM, EARTH_KM, RIM_KM, strikeGround, TSUNAMI_KM_S } from './groundModel';

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;

describe('the ground round a strike, by the strike clock (#1175, #1176)', () => {
  it('shows nothing before the strike', () => {
    const before = strikeGround(-5, 1);
    expect(before.cavityKm).toBe(0);
    expect(before.blanket).toBe(0);
    expect(before.tsunami).toBe(0);
  });

  it('opens a cavity about 100 km wide within tens of seconds, deep', () => {
    const half = strikeGround(40, 1);
    expect(half.cavityKm).toBeGreaterThan(0.95 * CAVITY_KM);
    expect(half.cavityKm).toBeLessThanOrEqual(CAVITY_KM);
    expect(half.depth).toBeGreaterThan(0.95);
    expect(strikeGround(40, 1).rim).toBe(0);
  });

  it('raises an uplift that falls outward into a ring of peaks, the crater about 200 km across', () => {
    expect(strikeGround(3 * MINUTE, 1).uplift).toBe(1);
    expect(strikeGround(5 * MINUTE, 1).uplift).toBe(0);
    const settled = strikeGround(10 * MINUTE, 1);
    expect(settled.peakRing).toBe(1);
    expect(settled.rim).toBe(1);
    expect(settled.cavityKm).toBeCloseTo(RIM_KM, 6);
    expect(settled.depth).toBeLessThan(0.2);
  });

  it('spreads its blanket near the crater in minutes and round the globe in hours, buried over ages', () => {
    const minutes = strikeGround(15 * MINUTE, 1);
    expect(minutes.blanketReach * EARTH_KM).toBeCloseTo(3 * RIM_KM, 6);
    expect(strikeGround(8 * HOUR, 1).blanketReach).toBeCloseTo(Math.PI, 6);
    expect(strikeGround(8 * HOUR, 0).blanketReach * EARTH_KM).toBeCloseTo(3 * RIM_KM, 6);
    expect(strikeGround(10 * YEAR, 1).blanket).toBe(1);
    expect(strikeGround(1e6 * YEAR, 1).blanket).toBe(0);
  });

  it('sends the tsunami out at a shallow-water wave’s speed, dying down over days', () => {
    expect(TSUNAMI_KM_S).toBeCloseTo(0.198, 3);
    expect(strikeGround(HOUR, 1).tsunamiFront * EARTH_KM).toBeCloseTo(TSUNAMI_KM_S * HOUR, 6);
    expect(strikeGround(10 * DAY, 1).tsunamiFront).toBe(Math.PI);
    expect(strikeGround(HOUR, 1).tsunami).toBe(1);
    expect(strikeGround(10 * DAY, 1).tsunami).toBe(0);
  });
});
