import { describe, expect, it } from 'vitest';

import {
  arrivalDirection,
  DELAY,
  delayBetween,
  earthFixed,
  HANFORD,
  JOURNEY_MS,
  journeyAt,
  journeyMs,
  journeyText,
  LIVINGSTON,
  reached,
} from './journey';

describe('which way GW150914 came (#833)', () => {
  const k = arrivalDirection();

  it('puts places on a round Earth, Earth-fixed', () => {
    expect(earthFixed(0, 0)).toEqual([1, 0, 0]);
    expect(earthFixed(90, 0)[2]).toBeCloseTo(1, 12);
    expect(earthFixed(0, 90)[1]).toBeCloseTo(1, 12);
  });

  it('reaches Hanford 6.9 ms after Livingston', () => {
    expect(Math.hypot(...k)).toBeCloseTo(1, 12);
    expect(delayBetween(k, LIVINGSTON, HANFORD)).toBeCloseTo(DELAY, 9);
  });

  it('comes from the south, of all the ways that give that delay', () => {
    // Travelling north: from the southern sky.
    expect(k[2]).toBeGreaterThan(0);
    const other = arrivalDirection(DELAY);
    expect(other).toEqual(k);
    expect(() => arrivalDirection(0.02)).toThrow('no direction');
  });
});

describe('the journey, as played', () => {
  const k = arrivalDirection();

  it('counts down 1.3 billion years, then sweeps Earth to the millisecond', () => {
    const start = journeyAt(0, 0.41, k);
    expect(start.phase).toBe('travel');
    expect(start.yearsToGo).toBeCloseTo(1.3e9 - 1, -3);
    expect(journeyText(start, k)).toBe(
      'Crossing space at the speed of light: 1.30 billion years to go',
    );
    expect(journeyText(journeyAt(JOURNEY_MS.travel / 2, 0.41, k), k)).toMatch(
      /thousand years to go$/,
    );
    expect(journeyText(journeyAt(JOURNEY_MS.travel * 0.9, 0.41, k), k)).toMatch(
      /^Crossing.* \d+ years to go$/,
    );
    expect(journeyText(journeyAt(JOURNEY_MS.travel * 0.2, 0.41, k), k)).toMatch(/million years/);
    expect(journeyMs()).toBe(JOURNEY_MS.travel + JOURNEY_MS.arrive + JOURNEY_MS.rest);
  });

  it('has Livingston hear it at the given time, and Hanford 6.9 ms later', () => {
    let livingston: number | null = null;
    let hanford: number | null = null;
    for (let ms = JOURNEY_MS.travel; ms <= JOURNEY_MS.travel + JOURNEY_MS.arrive; ms += 1) {
      const moment = journeyAt(ms, 0.41, k);
      if (livingston === null && reached(moment, LIVINGSTON, k)) livingston = moment.utc;
      if (hanford === null && reached(moment, HANFORD, k)) hanford = moment.utc;
    }
    expect(livingston).toBeCloseTo(0.41, 3);
    expect((hanford ?? 0) - (livingston ?? 0)).toBeCloseTo(DELAY, 3);
  });

  it('says what is heard where, with the time', () => {
    const say = (ms: number): string => journeyText(journeyAt(ms, 0.41, k), k);
    expect(say(JOURNEY_MS.travel)).toMatch(/^09:50:45\.3\d\d UTC · reaching Earth$/);
    expect(say(JOURNEY_MS.travel + JOURNEY_MS.arrive)).toContain('Hanford hears it');
    expect(journeyAt(1e9, 0.41, k).phase).toBe('rest');
    const between = [...Array(JOURNEY_MS.arrive).keys()]
      .map((ms) => say(JOURNEY_MS.travel + ms))
      .find((text) => text.includes('Livingston hears it first'));
    expect(between).toBeDefined();
  });
});
