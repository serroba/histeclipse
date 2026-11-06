import { describe, expect, it } from 'vitest';

import type { WaysAt } from '../data/waysOfLife';
import { legendWays } from './waysLegend';

function at(counts: Partial<WaysAt['counts']>): WaysAt {
  return {
    year: -2000,
    regions: [],
    counts: {
      foraging: 0,
      pastoralism: 0,
      extensive: 0,
      intensive: 0,
      urban: 0,
      mixed: 0,
      ...counts,
    },
  };
}

describe('the ways of life key', () => {
  it('lists only the ways shown somewhere, in their fixed order, not by how many', () => {
    expect(legendWays(at({ urban: 1, foraging: 40, mixed: 3 }))).toEqual([
      'foraging',
      'urban',
      'mixed',
    ]);
  });

  it('lists nothing when no region is rated', () => {
    expect(legendWays(at({}))).toEqual([]);
  });
});
