import { describe, expect, it } from 'vitest';

import { insideRings, insideWrapped, ringsOf } from './polygons';

const square = ringsOf([[1000, 1000, 2000, 1000, 2000, 2000, 1000, 2000]], 100);
const hole = ringsOf([[1400, 1400, 1600, 1400, 1600, 1600, 1400, 1600]], 100);

describe('points in rings', () => {
  it('finds points inside, and not in holes', () => {
    expect(insideRings(square, 12, 12)).toBe(true);
    expect(insideRings([...square, ...hole], 15, 15)).toBe(false);
    expect(insideRings(square, 25, 12)).toBe(false);
  });

  it('minds rings that run past 180°', () => {
    const across = ringsOf([[17_000, 0, 19_000, 0, 19_000, 500, 17_000, 500]], 100);
    expect(insideWrapped(across, -175, 2)).toBe(true);
    expect(insideWrapped(across, 0, 2)).toBe(false);
  });
});
