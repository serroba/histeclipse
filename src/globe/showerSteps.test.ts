import { describe, expect, it } from 'vitest';

import { DIPOLE_TODAY } from '../data/radiocarbonProduction';
import { captionOf, SHOWER_MS, SHOWER_STEPS, stepAt, turnedAway } from './showerSteps';

describe('a cosmic-ray shower, step by step', () => {
  it('plays its steps in order, then ends', () => {
    expect(stepAt(-1)).toBeNull();
    expect(SHOWER_STEPS.map(({ at }) => stepAt(at))).toEqual([
      'rays',
      'shower',
      'capture',
      'dioxide',
      'drift',
    ]);
    expect(stepAt(SHOWER_MS - 1)).toBe('drift');
    expect(stepAt(SHOWER_MS)).toBeNull();
  });

  it('turns the equator’s ray away unless the field is weak', () => {
    expect(turnedAway(DIPOLE_TODAY)).toBe(true);
    expect(turnedAway(0.3)).toBe(false);
    expect(turnedAway(0)).toBe(false);
    expect(captionOf('rays', DIPOLE_TODAY)).toContain('bends this one back out');
    expect(captionOf('rays', 0)).toContain('reach the air at the equator too');
  });

  it('captions each step', () => {
    for (const { step } of SHOWER_STEPS)
      expect(captionOf(step, DIPOLE_TODAY).length).toBeGreaterThan(20);
    expect(captionOf('capture', DIPOLE_TODAY)).toContain('n + ¹⁴N → ¹⁴C + p');
  });
});
