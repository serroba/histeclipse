import { describe, expect, it } from 'vitest';

import fc from 'fast-check';

import { PACES, paceSpeed, deepSpeedText, deepSpeedWords, prefetchFrames } from './playSpeed';

describe('deep time play speeds', () => {
  it('Given the 540 Myr span, Then Normal sweeps it in about 20 s, Slow in two minutes, Fast in six (#1076)', () => {
    expect(paceSpeed(540, 'normal')).toBe(20);
    expect(paceSpeed(540, 'slow')).toBe(5);
    expect(paceSpeed(540, 'fast')).toBe(100);
    expect(paceSpeed(2.6, 'normal')).toBe(0.1);
    expect(paceSpeed(48, 'normal')).toBe(2);
  });

  it('Given any window, Then each pace sweeps it in about its time, faster paces faster, never under 100 years a second', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 4568, noNaN: true }), (windowMa) => {
        const [slow, normal, fast] = PACES.map((pace) => paceSpeed(windowMa, pace));
        expect(slow).toBeLessThanOrEqual(normal ?? 0);
        expect(normal).toBeLessThanOrEqual(fast ?? 0);
        const seconds = windowMa / (normal ?? 1);
        // Rounded to 1, 2 or 5 × 10ⁿ, a sweep takes from 0.7 to 1.75 times its time.
        expect(seconds).toBeGreaterThanOrEqual(20 * 0.7 - 1e-9);
        expect(seconds).toBeLessThanOrEqual(20 * 1.75 + 1e-9);
      }),
    );
    expect(paceSpeed(0.001, 'slow')).toBe(0.0001);
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

  it('says a speed under a thousand years a second in years', () => {
    expect(deepSpeedText(0.0005)).toBe('500 yr/s');
  });
});

describe('prefetchFrames', () => {
  it('Given a slow play, Then a few maps load ahead; faster, more, to keep up', () => {
    expect(prefetchFrames(1)).toBe(4);
    expect(prefetchFrames(20)).toBe(4);
    expect(prefetchFrames(100)).toBe(20);
  });
});
