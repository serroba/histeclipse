import { describe, expect, it } from 'vitest';

import { DIPOLE_TODAY } from '../data/radiocarbonProduction';
import {
  captionOf,
  equatorCutoffGeV,
  landing,
  nextStepStart,
  previousStepStart,
  stepEnd,
  rayLabels,
  SHOWER_MS,
  SHOWER_STEPS,
  stepAt,
  turnedAway,
} from './showerSteps';

describe('a cosmic-ray shower, step by step', () => {
  it('plays its steps in order, then ends', () => {
    expect(stepAt(-1)).toBeNull();
    expect(SHOWER_STEPS.map(({ at }) => stepAt(at))).toEqual([
      'rays',
      'shower',
      'capture',
      'dioxide',
      'fall',
      'plant',
    ]);
    expect(stepAt(SHOWER_MS - 1)).toBe('plant');
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

  it('labels the rays with their energies: the equator’s cutoff from the field', () => {
    // Today's cutoff at the equator, 14.8 GV, is a proton of about 13.9 GeV.
    expect(equatorCutoffGeV(DIPOLE_TODAY)).toBeCloseTo(13.9, 1);
    expect(rayLabels(DIPOLE_TODAY)).toEqual({
      polar: 'Cosmic ray: a proton of a few GeV',
      equator: 'Turned away: under 14 GeV',
    });
    expect(rayLabels(0.3).equator).toBe('Let in: the field is too weak to turn it');
    expect(captionOf('plant', DIPOLE_TODAY)).toContain('photosynthesis');
    expect(captionOf('fall', DIPOLE_TODAY)).toContain('falls');
  });

  it('lands a little toward the equator, and says algae take it in at sea', () => {
    expect(landing({ latitude: 48, longitude: 10 })).toEqual({ latitude: 45.1, longitude: 10 });
    expect(captionOf('plant', DIPOLE_TODAY, true)).toContain('Algae');
    expect(captionOf('plant', DIPOLE_TODAY, true)).toContain('400–600 radiocarbon years');
    expect(captionOf('plant', DIPOLE_TODAY)).toContain('A leaf');
  });

  it('steps forward and back as a player does', () => {
    expect(nextStepStart(0)).toBe(2200);
    expect(nextStepStart(2200)).toBe(5000);
    expect(nextStepStart(13_000)).toBe(SHOWER_MS);
    // Well into a step, back goes to its start; just after it began, to the one before.
    expect(previousStepStart(6500)).toBe(5000);
    expect(previousStepStart(5300)).toBe(2200);
    expect(previousStepStart(300)).toBe(0);
    expect(stepEnd(5000)).toBe(7199);
  });
});
