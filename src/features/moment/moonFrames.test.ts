import data from 'astronomia/data/elpMppDe';
import { Moon } from 'astronomia/elp';
import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';

import { createMoonEphemeris, type MoonEphemeris } from '../../astro/moon';
import { julianDayNumber } from '../../time/julianDay';
import { moonBetween, moonForFrames, STEP_DAYS } from './moonFrames';

const exact = createMoonEphemeris(data, Moon);

function distanceKm(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}

/** An ephemeris that counts how often it is asked. */
function counting(): { ephemeris: MoonEphemeris; asked: () => number } {
  const position = vi.fn((jdTT: number) => exact.position(julianDayNumber(jdTT)));
  return { ephemeris: { position }, asked: () => position.mock.calls.length };
}

describe('moonBetween', () => {
  it('stays within a metre of ELP/MPP02, from 4000 BCE to 3000 CE', () => {
    // 4000 BCE to 3000 CE, as Julian Days (TT).
    fc.assert(
      fc.property(fc.double({ min: 260_000, max: 2_817_000, noNaN: true }), (jd) => {
        const between = moonBetween(exact);
        // A frame before, so this one is worked out between the grid's points.
        between.position(julianDayNumber(jd - STEP_DAYS / 3));
        const at = julianDayNumber(jd);
        expect(distanceKm(between.position(at), exact.position(at))).toBeLessThan(1e-3);
      }),
      { numRuns: 300 },
    );
  });

  it('gives the exact position on the grid', () => {
    const at = julianDayNumber(2_460_409 + 7 * STEP_DAYS);
    expect(moonBetween(exact).position(at)).toEqual(exact.position(at));
  });

  it('asks ELP about once an hour of the Moon’s time, however many frames in between', () => {
    const { ephemeris, asked } = counting();
    const between = moonBetween(ephemeris);
    // An eclipse playing at an hour a second for six seconds, at 60 frames a second.
    const start = 2_460_409.5;
    for (let frame = 0; frame < 360; frame += 1) {
      between.position(julianDayNumber(start + (frame / 60) * STEP_DAYS));
    }
    expect(asked()).toBeLessThanOrEqual(10);
  });

  it('asks ELP once a frame, not four times, when each frame jumps far (travelling the years)', () => {
    const { ephemeris, asked } = counting();
    const between = moonBetween(ephemeris);
    // 50 years a second at 60 frames a second: about 300 days a frame.
    for (let frame = 0; frame < 120; frame += 1) {
      const at = julianDayNumber(-1_000_000 + frame * 304.4);
      expect(between.position(at)).toEqual(exact.position(at));
    }
    expect(asked()).toBe(120);
  });

  it('plays backwards as well as forwards from the positions it keeps', () => {
    const { ephemeris, asked } = counting();
    const between = moonBetween(ephemeris);
    const start = 2_460_409.5;
    for (let frame = 0; frame < 60; frame += 1) {
      between.position(julianDayNumber(start + (frame / 60) * STEP_DAYS));
    }
    const forward = asked();
    for (let frame = 60; frame >= 0; frame -= 1) {
      between.position(julianDayNumber(start + (frame / 60) * STEP_DAYS));
    }
    expect(asked() - forward).toBeLessThanOrEqual(1);
  });
});

describe('moonForFrames', () => {
  it('has no Moon before the ephemeris loads, and keeps one per ephemeris', () => {
    const forFrames = moonForFrames();
    expect(forFrames(null)).toBeNull();
    const first = forFrames(exact);
    expect(forFrames(exact)).toBe(first);
    expect(forFrames(createMoonEphemeris(data, Moon))).not.toBe(first);
  });
});
