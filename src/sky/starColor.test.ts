import { describe, expect, it } from 'vitest';

import { starColor, temperatureFromBV } from './starColor';

describe('starColor', () => {
  it('puts the Sun (B−V 0.65) near 5,800 K and Vega (0.0) near 10,000 K', () => {
    expect(temperatureFromBV(0.65)).toBeGreaterThan(5600);
    expect(temperatureFromBV(0.65)).toBeLessThan(6000);
    expect(temperatureFromBV(0)).toBeGreaterThan(9000);
  });

  it('makes Betelgeuse orange and Rigel blue-white', () => {
    const [r1, , b1] = starColor(1.85);
    const [r2, , b2] = starColor(-0.03);
    expect(r1).toBeGreaterThan(b1);
    expect(b2).toBeGreaterThanOrEqual(r2);
  });

  it('keeps every colour light, and white when unknown', () => {
    for (let bv = -1; bv <= 3; bv += 0.05) {
      for (const channel of starColor(bv)) {
        expect(channel).toBeGreaterThanOrEqual(0.45);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
    expect(starColor(null)).toEqual([1, 1, 1]);
  });
});
