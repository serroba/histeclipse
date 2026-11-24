import { describe, expect, it } from 'vitest';

import {
  APPROACH_SECONDS,
  clockStep,
  clockText,
  CLOCK_END,
  durationText,
  maAfter,
  positionAt,
  QUIET_AT,
  secondsAt,
  STRIKE_AT,
} from './strikeClock';

const YEAR = 365.25 * 86_400;

describe('the strike clock: time from a strike on a log scale (#1173)', () => {
  it('starts with the approach, strikes after it, and runs a tenfold a unit to a million years', () => {
    expect(secondsAt(0)).toBe(-APPROACH_SECONDS);
    expect(secondsAt(STRIKE_AT)).toBe(0);
    expect(secondsAt(STRIKE_AT + 2)).toBeCloseTo(99, 6);
    expect(secondsAt(CLOCK_END)).toBeCloseTo(1e6 * YEAR, -3);
    expect(secondsAt(-5)).toBe(-APPROACH_SECONDS);
    expect(secondsAt(99)).toBeCloseTo(1e6 * YEAR, -3);
  });

  it('finds the place of a moment again', () => {
    for (const seconds of [-APPROACH_SECONDS, -3, 0, 1, 60, 3600, 5 * YEAR, 1e6 * YEAR]) {
      expect(secondsAt(positionAt(seconds))).toBeCloseTo(seconds, -1);
    }
    expect(positionAt(-99)).toBe(0);
    expect(positionAt(1e9 * YEAR)).toBe(CLOCK_END);
  });

  it('plays faster at a faster pace', () => {
    expect(clockStep('slow', 1)).toBeLessThan(clockStep('normal', 1));
    expect(clockStep('normal', 1)).toBeLessThan(clockStep('fast', 1));
    // The whole clock at Normal in about twenty seconds.
    let played = 0;
    for (let at = 0; at < CLOCK_END; played += 0.01) at += clockStep('normal', 0.01, at);
    expect(played).toBeGreaterThan(15);
    expect(played).toBeLessThan(25);
  });

  it('plays the approach at a third, and the quiet after the sky clears at twice (#1187)', () => {
    const strike = clockStep('normal', 1);
    expect(clockStep('normal', 1, 0)).toBeCloseTo(strike / 3, 9);
    expect(clockStep('normal', 1, QUIET_AT - 0.01)).toBe(strike);
    expect(clockStep('normal', 1, QUIET_AT)).toBe(2 * strike);
    expect(secondsAt(QUIET_AT)).toBeCloseTo(10 * YEAR, -3);
  });

  it('says the moment in words, in the largest unit that holds it', () => {
    expect(clockText(0)).toBe('The strike');
    expect(clockText(-10)).toBe('10 seconds before');
    expect(clockText(1)).toBe('1 second after');
    expect(clockText(3 * 3600)).toBe('3 hours after');
    expect(clockText(1.5 * 86_400)).toBe('1.5 days after');
    expect(durationText(2 * YEAR)).toBe('2 years');
    expect(durationText(30_000 * YEAR)).toBe('30 thousand years');
    expect(durationText(1e6 * YEAR)).toBe('1 million years');
    expect(durationText(250)).toBe('4.2 minutes');
  });

  it('moves deep time on by the seconds since the strike, never back', () => {
    expect(maAfter(66, -5)).toBe(66);
    expect(maAfter(66, 1e6 * YEAR)).toBeCloseTo(65, 9);
  });
});
