import { describe, expect, it } from 'vitest';

import {
  cutoffRigidity,
  DIPOLE_TODAY,
  FIELD_CHOICES,
  globalFor,
  globalProduction,
  localProduction,
  productionProfile,
  profileFor,
  SUN_CHOICES,
} from './radiocarbonProduction';

const choice = <T extends { id: string }>(all: readonly T[], id: string): T => {
  const found = all.find((each) => each.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe('carbon-14 made by cosmic rays (Kovaltsov et al. 2012)', () => {
  it('matches the paper’s own rates for today’s field', () => {
    // The paper: 2.2 at the 2010 solar minimum, 1.1 at the 1990 maximum, 1.64 on average
    // for 1951–2010 (with the real field's shape, not a dipole's; a few % apart).
    expect(globalProduction(DIPOLE_TODAY, 300)).toBeGreaterThan(2.1);
    expect(globalProduction(DIPOLE_TODAY, 300)).toBeLessThan(2.35);
    expect(globalProduction(DIPOLE_TODAY, 1200)).toBeGreaterThan(1.1);
    expect(globalProduction(DIPOLE_TODAY, 1200)).toBeLessThan(1.4);
    const cycle = globalFor(choice(FIELD_CHOICES, 'today'), choice(SUN_CHOICES, 'cycle'));
    expect(cycle).toBeGreaterThan(1.6);
    expect(cycle).toBeLessThan(1.85);
  });

  it('nearly doubles with no field, and moves by about 15% over the Holocene’s', () => {
    const today = globalProduction(DIPOLE_TODAY, 650);
    expect(globalProduction(0, 650) / today).toBeGreaterThan(1.9);
    expect(globalProduction(0, 650) / today).toBeLessThan(2.4);
    expect(globalProduction(6, 650) / today).toBeLessThan(1.2);
    expect(globalProduction(10, 650) / today).toBeGreaterThan(0.85);
  });

  it('is made mostly toward the poles, where the field shields least', () => {
    const profile = productionProfile(DIPOLE_TODAY, 650);
    expect(profile).toHaveLength(19);
    const equator = profile[0] ?? 0;
    const pole = profile[18] ?? 0;
    expect(pole / equator).toBeGreaterThan(5);
    expect(pole / equator).toBeLessThan(8);
    for (let i = 1; i < profile.length; i += 1) {
      expect(profile[i] ?? 0).toBeGreaterThanOrEqual(profile[i - 1] ?? 0);
    }
    // With no field every latitude gets the same.
    expect(localProduction(0, 0, 650)).toBeCloseTo(localProduction(90, 0, 650), 6);
  });

  it('rises as the Sun quietens', () => {
    const rates = [1200, 300, 100].map((phi) => globalProduction(DIPOLE_TODAY, phi));
    expect(rates[1]).toBeGreaterThan(rates[0] ?? 0);
    expect(rates[2]).toBeGreaterThan(rates[1] ?? 0);
  });

  it('cuts off by the field: strongest at the equator, nothing at the pole', () => {
    expect(cutoffRigidity(0, DIPOLE_TODAY)).toBeCloseTo(14.82, 2);
    expect(cutoffRigidity(90, DIPOLE_TODAY)).toBeCloseTo(0, 6);
  });

  it('averages a Sun’s states', () => {
    const today = choice(FIELD_CHOICES, 'today');
    const cycle = profileFor(today, choice(SUN_CHOICES, 'cycle'));
    const quiet = profileFor(today, choice(SUN_CHOICES, 'quiet'));
    const active = profileFor(today, choice(SUN_CHOICES, 'active'));
    expect(cycle[9]).toBeCloseTo(((quiet[9] ?? 0) + (active[9] ?? 0)) / 2, 9);
  });
});
