import { describe, expect, it } from 'vitest';

import { fitSecularCorrection, secularCorrectionAt } from './secularFit';

describe('fitSecularCorrection', () => {
  it('recovers a known correction exactly', () => {
    const truth = [0.013, 0.0037, 0.0000078] as const;
    const residuals = Array.from({ length: 50 }, (_, i) => {
      const T = -60 + i * 2.1;
      return { T, arcseconds: secularCorrectionAt(truth, T) };
    });
    const fitted = fitSecularCorrection(residuals);
    fitted.forEach((value, index) => {
      expect(value).toBeCloseTo(truth[index] ?? Number.NaN, 12);
    });
  });

  it('refuses residuals that cannot determine three terms', () => {
    expect(() => fitSecularCorrection([])).toThrow(RangeError);
  });

  it('evaluates the correction', () => {
    expect(secularCorrectionAt([1, 0, 0], 3)).toBe(9);
    expect(secularCorrectionAt([0, 1, 1], -2)).toBe(-8 + 16);
  });
});
