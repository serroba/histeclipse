import { describe, expect, it } from 'vitest';

import { between, type PathPoint } from './pathCurve';

/** A loop about a point 1.5 million km out, 800,000 km across, once every 180 days. */
function loopAt(t: number): readonly [number, number, number] {
  const angle = (2 * Math.PI * t) / 180;
  return [-1.5e6, 800_000 * Math.cos(angle), 400_000 * Math.sin(angle)];
}

/** That loop kept every `step` days, as the pipeline might keep it. */
function kept(step: number, days = 360): PathPoint[] {
  return Array.from({ length: Math.floor(days / step) + 1 }, (_, k) => [
    k * step,
    ...loopAt(k * step),
  ]);
}

/** A straight line between kept points, as before (#996). */
function straight(points: readonly PathPoint[], low: number, t: number): number[] {
  const a = points[low] ?? [0, 0, 0, 0];
  const b = points[low + 1] ?? a;
  const s = (t - a[0]) / (b[0] - a[0]);
  return [1, 2, 3].map((i) => (a[i] ?? 0) + s * ((b[i] ?? 0) - (a[i] ?? 0)));
}

const off = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0), (a[2] ?? 0) - (b[2] ?? 0));

describe('a craft between kept points (#996)', () => {
  it('Given a loop kept every 20 days, turning up to 80° at a point, as JWST’s, Then the curve is far nearer it than straight lines', () => {
    const points = kept(20);
    let curved = 0;
    let lines = 0;
    for (let low = 1; low + 2 < points.length; low += 1) {
      const t = (points[low]?.[0] ?? 0) + 10;
      curved = Math.max(curved, off(between(points, low, t), loopAt(t)));
      lines = Math.max(lines, off(straight(points, low, t), loopAt(t)));
    }
    expect(lines).toBeGreaterThan(40_000);
    expect(curved).toBeLessThan(lines / 5);
  });

  it('Given a kept point, Then the craft is exactly there', () => {
    const points = kept(29);
    expect(between(points, 3, 87)).toEqual([-1.5e6, ...loopAt(87).slice(1)]);
  });

  it('Given a sharp turn at a kept point, Then the lines either side stay straight', () => {
    const corner: PathPoint[] = [
      [100, 0, 0, 0],
      [104, 400, 0, 0],
      [110, 400, 600, 0],
    ];
    expect(between(corner, 0, 102)).toEqual([200, 0, 0]);
    expect(between(corner, 1, 107)).toEqual([400, 300, 0]);
  });

  it('Given steady flight in a straight line, Then the curve is that line', () => {
    const line: PathPoint[] = [
      [0, 0, 0, 0],
      [3, 30, 0, 0],
      [10, 100, 0, 0],
      [11, 110, 0, 0],
    ];
    const [x, y, z] = between(line, 1, 6);
    expect(x).toBeCloseTo(60, 9);
    expect([y, z]).toEqual([0, 0]);
  });

  it('Given the last kept point, or two at one moment, Then the craft is at that point', () => {
    expect(between([[0, 1, 2, 3]], 0, 0)).toEqual([1, 2, 3]);
    expect(
      between(
        [
          [5, 1, 2, 3],
          [5, 4, 5, 6],
        ],
        0,
        5,
      ),
    ).toEqual([1, 2, 3]);
  });
});
