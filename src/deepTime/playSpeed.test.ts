import { describe, expect, it } from 'vitest';

import {
  DEEP_SPEEDS,
  DEFAULT_DEEP_SPEED,
  deepSpeedFor,
  deepSpeedText,
  deepSpeedWords,
  prefetchFrames,
} from './playSpeed';

describe('deep time play speeds', () => {
  it('gives each span a few speeds, its default among them', () => {
    for (const scale of ['ice', 'all', 'eons'] as const) {
      expect(DEEP_SPEEDS[scale]).toContain(DEFAULT_DEEP_SPEED[scale]);
      expect([...DEEP_SPEEDS[scale]].sort((a, b) => a - b)).toEqual(DEEP_SPEEDS[scale]);
    }
  });

  it('says a speed in the units of its span', () => {
    expect(deepSpeedText(0.05)).toBe('50 kyr/s');
    expect(deepSpeedText(0.01)).toBe('10 kyr/s');
    expect(deepSpeedText(0.001)).toBe('1 kyr/s');
    expect(deepSpeedWords(0.001)).toBe('1,000 years a second');
    expect(deepSpeedWords(0.05)).toBe('50,000 years a second');
    expect(deepSpeedWords(20)).toBe('20 million years a second');
    expect(deepSpeedText(20)).toBe('20 Myr/s');
    expect(deepSpeedText(250)).toBe('250 Myr/s');
  });

  it('keeps a chosen speed only where the span offers it', () => {
    expect(deepSpeedFor('all', 50)).toBe(50);
    expect(deepSpeedFor('ice', 50)).toBe(0.05);
    expect(deepSpeedFor('eons', undefined)).toBe(100);
  });
});

describe('prefetchFrames', () => {
  it('Given a slow play, Then a few maps load ahead; faster, more, to keep up', () => {
    expect(prefetchFrames(1)).toBe(4);
    expect(prefetchFrames(20)).toBe(4);
    expect(prefetchFrames(100)).toBe(20);
  });
});
