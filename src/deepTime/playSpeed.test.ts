import { describe, expect, it } from 'vitest';

import { DEEP_SPEEDS, DEFAULT_DEEP_SPEED, deepSpeedFor, deepSpeedText } from './playSpeed';

describe('deep time play speeds', () => {
  it('gives each span a few speeds, its default among them', () => {
    for (const scale of ['ice', 'all', 'eons'] as const) {
      expect(DEEP_SPEEDS[scale]).toContain(DEFAULT_DEEP_SPEED[scale]);
      expect([...DEEP_SPEEDS[scale]].sort((a, b) => a - b)).toEqual(DEEP_SPEEDS[scale]);
    }
  });

  it('says a speed in the units of its span', () => {
    expect(deepSpeedText(0.05)).toBe('50,000 years/s');
    expect(deepSpeedText(0.01)).toBe('10,000 years/s');
    expect(deepSpeedText(20)).toBe('20 Myr/s');
    expect(deepSpeedText(250)).toBe('250 Myr/s');
  });

  it('keeps a chosen speed only where the span offers it', () => {
    expect(deepSpeedFor('all', 50)).toBe(50);
    expect(deepSpeedFor('ice', 50)).toBe(0.05);
    expect(deepSpeedFor('eons', undefined)).toBe(100);
  });
});
