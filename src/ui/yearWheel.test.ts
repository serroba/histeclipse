import { describe, expect, it } from 'vitest';

import { joinYear, splitYear } from './yearWheel';

describe('the year wheel', () => {
  it('splits a year into its hundreds and the years within them', () => {
    expect(splitYear(1926)).toEqual([19, 26]);
    expect(splitYear(9700)).toEqual([97, 0]);
    expect(splitYear(5)).toEqual([0, 5]);
  });

  it('joins the columns into a year, kept within the era', () => {
    const bce = { min: 1, max: 9700 };
    expect(joinYear(5, 87, bce)).toBe(587);
    // 97 | 50 would be 9750 BCE, before the Holocene: the wheel stops at 9700.
    expect(joinYear(97, 50, bce)).toBe(9700);
    // There is no year 0.
    expect(joinYear(0, 0, bce)).toBe(1);
  });
});
