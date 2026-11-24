import { describe, expect, it } from 'vitest';

import { pointThen } from './placesThen';

const STEPS = { stepMa: 5, scale: 100 };

describe('a place carried back in steps', () => {
  it('is where its step has it, and between two steps in between', () => {
    const then = [[1000, 2000], [2000, 4000], null] as const;
    expect(pointThen(then, STEPS, 0)).toEqual({ latitude: 10, longitude: 20 });
    expect(pointThen(then, STEPS, 2.5)).toEqual({ latitude: 15, longitude: 30 });
  });

  it('stays at its last step where the next is past the end', () => {
    expect(pointThen([[1000, 2000]], STEPS, 3)).toEqual({ latitude: 10, longitude: 20 });
  });

  it('is nowhere on no plate, or past its steps', () => {
    expect(pointThen([[0, 0], null], STEPS, 5)).toBeNull();
    expect(pointThen([[0, 0]], STEPS, 50)).toBeNull();
  });

  it('crosses the antimeridian the short way round, either way', () => {
    for (const then of [
      [
        [0, 17900],
        [0, -17900],
      ],
      [
        [0, -17900],
        [0, 17900],
      ],
    ] as const) {
      expect(Math.abs(pointThen(then, STEPS, 2.5)?.longitude ?? 0)).toBeCloseTo(180);
    }
    expect(
      pointThen(
        [
          [0, 17900],
          [0, -17700],
        ],
        STEPS,
        2.5,
      )?.longitude,
    ).toBeCloseTo(-179);
  });
});
