import { describe, expect, it, vi } from 'vitest';

import { julianDayNumber } from '../time/julianDay';
import { gridBetween } from './gridBetween';
import { loadPlanetEphemeris } from './planets';

/** A body going round in 10 days, 1000 km out, counting how often it is asked. */
function circling() {
  const exact = vi.fn((jd: number): [number, number, number] => [
    1000 * Math.cos((2 * Math.PI * jd) / 10),
    1000 * Math.sin((2 * Math.PI * jd) / 10),
    0,
  ]);
  return exact;
}

const apart = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('a place frame after frame, on a grid (#783)', () => {
  it('Given frames a day apart, Then the coarse grid: a few exact places, close to the series', () => {
    const exact = circling();
    const at = gridBetween(exact, 1 / 24, 2);
    let worst = 0;
    for (let jd = 0; jd < 40; jd += 1) worst = Math.max(worst, apart(at(jd), exact(jd)));
    // 40 frames; the coarse grid's places every 2 days, not one a frame.
    expect(exact.mock.calls.length - 40).toBeLessThan(26);
    expect(worst).toBeLessThan(60);
  });

  it('Given the same moment asked again, Then the same answer: the bodies, then the craft at them', () => {
    const exact = circling();
    const at = gridBetween(exact, 1 / 24, 2);
    at(10);
    const first = at(11.3);
    exact.mockClear();
    expect(at(11.3)).toBe(first);
    expect(exact).not.toHaveBeenCalled();
  });

  it('Given time creeping on by minutes, Then the fine grid: the series, near enough', () => {
    const exact = circling();
    const at = gridBetween(exact, 1 / 24, 2);
    at(11.3);
    expect(apart(at(11.31), exact(11.31))).toBeLessThan(0.01);
  });

  it('Given a frame that jumps further than the coarse grid, Then the series itself, once', () => {
    const exact = circling();
    const at = gridBetween(exact, 1 / 24, 2);
    at(0);
    exact.mockClear();
    expect(at(100.5)).toEqual(exact(100.5));
    expect(exact).toHaveBeenCalledTimes(2);
  });

  it('Given Mercury on its one-day grid at 1.1 days a frame, Then within 300 km of VSOP87', async () => {
    const theory = await loadPlanetEphemeris();
    const exact = (jd: number) => theory.position('mercury', julianDayNumber(jd));
    const at = gridBetween(exact, 1 / 24, 1);
    let worst = 0;
    for (let jd = 2_440_000; jd < 2_440_000 + 1500; jd += 1.1) {
      worst = Math.max(worst, apart(at(jd), exact(jd)));
    }
    expect(worst).toBeLessThan(300);
  });
});
