import { describe, expect, it } from 'vitest';

import type { LunarEclipse } from '../data/lunarCatalog';
import { julianDayNumber } from '../time/julianDay';
import { lunarPhaseAt, lunarSemiDurations, SUBLUNAR_DRIFT_DEGREES_PER_HOUR } from './lunarPhases';

// Full durations in minutes from NASA's Five Millennium Canon (penumbral, partial, total).
describe('lunarSemiDurations', () => {
  it.each([
    ['2025 Mar 14 (total)', 0.3484, [362.6, 218.3, 65.4]],
    ['2025 Sep 7 (total)', -0.2752, [326.7, 209.4, 82.1]],
    ['621 BCE Apr 22 (partial)', 0.9127, [304.6, 93.3, 0]],
  ] as const)('is within 10%% of NASA for %s', (_name, gamma, [penumbral, partial, total]) => {
    const semi = lunarSemiDurations(gamma);
    const close = (ours: number, nasa: number) => {
      if (nasa === 0) expect(ours).toBe(0);
      else expect(Math.abs(2 * ours - nasa) / nasa).toBeLessThan(0.1);
    };
    close(semi.penumbral, penumbral);
    close(semi.partial, partial);
    close(semi.total, total);
  });
});

describe('grazing penumbral eclipses', () => {
  it('get a short duration, though not a precise one', () => {
    // 1969 Aug 27: gamma −1.5407, NASA 31.3 min. The Moon barely clips the penumbra, so the
    // duration hinges on the penumbra's exact size, where conventions differ.
    const semi = lunarSemiDurations(-1.5407);
    expect(2 * semi.penumbral).toBeGreaterThan(0);
    expect(2 * semi.penumbral).toBeLessThan(60);
    expect([semi.partial, semi.total]).toEqual([0, 0]);
  });
});

describe('lunarPhaseAt', () => {
  const eclipse: LunarEclipse = {
    jdTT: julianDayNumber(2_460_748.79161),
    kind: 'total',
    umbralMagnitude: 1.18,
    penumbralMagnitude: 2.26,
    gamma: 0.3484,
    deltaT: 69,
    sublunar: [2.68, -102.25],
  };

  it.each([
    [0, 'total'],
    [-30, 'total'],
    [60, 'partial'],
    [-150, 'penumbral'],
    [200, 'none'],
  ] as const)('is %s at %i minutes from greatest eclipse', (offset, phase) => {
    expect(lunarPhaseAt(eclipse, offset)).toBe(phase);
  });

  it('moves the sub-lunar point about 14.5° west per hour', () => {
    expect(SUBLUNAR_DRIFT_DEGREES_PER_HOUR).toBeCloseTo(14.49, 2);
  });
});
