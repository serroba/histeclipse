import { describe, expect, it } from 'vitest';

import { DIPOLE_TODAY } from '../data/radiocarbonProduction';
import {
  captionOf,
  equatorCutoffGeV,
  landing,
  nextStepStart,
  previousStepStart,
  stepEnd,
  SUN_MS,
  SUN_STORY,
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
    expect(nextStepStart(0)).toBe(4500);
    expect(nextStepStart(4500)).toBe(10_000);
    expect(nextStepStart(21_000)).toBe(SHOWER_MS);
    // Well into a step, back goes to its start; just after it began, to the one before.
    expect(previousStepStart(11_500)).toBe(10_000);
    expect(previousStepStart(10_300)).toBe(4500);
    expect(previousStepStart(300)).toBe(0);
    expect(stepEnd(10_000)).toBe(14_999);
  });

  it('starts from the Sun: its three steps, then the shower’s, navigated alike', () => {
    expect(SUN_STORY.steps.map(({ step }) => step)).toEqual([
      'fusion',
      'escape',
      'journey',
      'rays',
      'shower',
      'capture',
      'dioxide',
      'fall',
      'plant',
    ]);
    expect(SUN_STORY.offset).toBe(SUN_MS);
    expect(SUN_STORY.total).toBe(SUN_MS + SHOWER_MS);
    expect(stepAt(0, SUN_STORY)).toBe('fusion');
    expect(stepAt(SUN_MS, SUN_STORY)).toBe('rays');
    expect(stepAt(SUN_STORY.total, SUN_STORY)).toBeNull();
    expect(nextStepStart(SUN_MS - 1, SUN_STORY)).toBe(SUN_MS);
    expect(previousStepStart(SUN_MS + 100, SUN_STORY)).toBe(17_000);
    expect(stepEnd(0, SUN_STORY)).toBe(8999);
  });

  it('captions the Sun’s steps with the photon’s energies, and joins them at the leaf', () => {
    expect(captionOf('fusion', DIPOLE_TODAY)).toContain('0.511 MeV');
    expect(captionOf('escape', DIPOLE_TODAY)).toContain('170,000 years');
    expect(captionOf('journey', DIPOLE_TODAY)).toContain('441 THz');
    expect(captionOf('plant', DIPOLE_TODAY, false, true)).toContain('red photon');
    expect(captionOf('plant', DIPOLE_TODAY, true, true)).toContain('eight minutes ago');
    expect(captionOf('plant', DIPOLE_TODAY, true)).not.toContain('eight minutes');
  });
});
