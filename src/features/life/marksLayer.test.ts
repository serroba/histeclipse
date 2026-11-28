import { describe, expect, it } from 'vitest';

import { spread } from './marksLayer';

describe('the pictures round the globe', () => {
  it('leaves angles alone that are far enough apart', () => {
    expect(spread([0, 1, 2], 0.5)).toEqual([0, 1, 2]);
  });

  it('pushes crowded neighbours apart, keeping their order and their middle', () => {
    const out = spread([1, 1.05, 1.1], 0.3);
    expect(out[1]! - out[0]!).toBeGreaterThanOrEqual(0.3 - 1e-3);
    expect(out[2]! - out[1]!).toBeGreaterThanOrEqual(0.3 - 1e-3);
    expect((out[0]! + out[2]!) / 2).toBeCloseTo(1.05, 1);
  });
});
