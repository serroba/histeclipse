import { describe, expect, it } from 'vitest';

import { hex, MAP_KEY, MILESTONE_KEY } from './colourKey';
import { MILESTONES } from './milestones';

describe('the colour key', () => {
  it('writes shader colours as CSS hex, clamped', () => {
    expect(hex(0, 0.5, 1)).toBe('#0080ff');
    expect(hex(-1, 2, 0.04)).toBe('#00ff0a');
  });

  it('labels every kind of milestone once', () => {
    const kinds = new Set(MILESTONES.map(({ kind }) => kind));
    expect(new Set(MILESTONE_KEY.map(({ kind }) => kind))).toEqual(kinds);
    expect(MILESTONE_KEY).toHaveLength(kinds.size);
  });

  it('gives every map entry a swatch', () => {
    for (const entry of MAP_KEY) expect(entry.swatch).toMatch(/^(#[0-9a-f]{6}|linear-gradient)/);
  });
});
