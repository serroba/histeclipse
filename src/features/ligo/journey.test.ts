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
  laterThanLivingston,
  LIVINGSTON,
  pairAt,
  pathTable,
  reached,
} from './journey';
import type { Waveform } from './strain';

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
    expect(laterThanLivingston(HANFORD, k)).toBeCloseTo(DELAY, 9);
    expect(laterThanLivingston(LIVINGSTON, k)).toBe(0);
  });

  it('comes from the south, of all the ways that give that delay', () => {
    expect(k[2]).toBeGreaterThan(0);
    expect(() => arrivalDirection(0.02)).toThrow('no direction');
  });
});

describe('the journey, as played (#841)', () => {
  it('counts down 1.3 billion years, then plays the wave at Earth 100 times slower', () => {
    const start = journeyAt(0, 0.41);
    expect(start.phase).toBe('travel');
    expect(start.yearsToGo).toBeCloseTo(1.3e9 - 1, -3);
    expect(journeyText(start)).toBe(
      'Crossing space at the speed of light: 1.30 billion years to go',
    );
    expect(journeyText(journeyAt(JOURNEY_MS.travel / 2, 0.41))).toMatch(/thousand years to go$/);
    expect(journeyText(journeyAt(JOURNEY_MS.travel * 0.2, 0.41))).toMatch(/million years/);
    const a = journeyAt(JOURNEY_MS.travel + 1000, 0.41);
    const b = journeyAt(JOURNEY_MS.travel + 2000, 0.41);
    expect(b.waveTime - a.waveTime).toBeCloseTo(0.01, 9);
    expect(a.utc).toBeCloseTo(0.41 + a.waveTime, 12);
    expect(journeyMs()).toBe(JOURNEY_MS.travel + JOURNEY_MS.arrive + JOURNEY_MS.rest);
    expect(journeyAt(1e9, 0.41).phase).toBe('rest');
  });

  it('has the merger reach Livingston at the given time, and Hanford 6.9 ms later', () => {
    let livingston: number | null = null;
    let hanford: number | null = null;
    for (let ms = JOURNEY_MS.travel; ms <= JOURNEY_MS.travel + JOURNEY_MS.arrive; ms += 1) {
      const moment = journeyAt(ms, 0.41);
      if (livingston === null && reached(moment, LIVINGSTON)) livingston = moment.utc;
      if (hanford === null && reached(moment, HANFORD)) hanford = moment.utc;
    }
    expect(livingston).toBeCloseTo(0.41, 3);
    expect((hanford ?? 0) - (livingston ?? 0)).toBeCloseTo(DELAY, 3);
  });

  it('says what is heard where, with the time', () => {
    const say = (ms: number): string => journeyText(journeyAt(ms, 0.41));
    expect(say(JOURNEY_MS.travel)).toMatch(/^09:50:45\.300 UTC · reaching Earth$/);
    expect(say(JOURNEY_MS.travel + JOURNEY_MS.arrive)).toContain('Hanford hears it');
    const heard = [...Array(Math.round(JOURNEY_MS.arrive)).keys()]
      .map((ms) => say(JOURNEY_MS.travel + ms))
      .find((text) => text.includes('Livingston hears it first'));
    expect(heard).toBeDefined();
  });
});

describe('the wave along its path about Earth (#841)', () => {
  /** A steady tone at `hertz`: h₊ = cos 2πft, h× = sin 2πft. */
  const tone = (hertz: number): Waveform => ({
    start: -10,
    end: 10,
    peak: 1,
    at: (t) => ({
      plus: Math.cos(2 * Math.PI * hertz * t),
      cross: Math.sin(2 * Math.PI * hertz * t),
    }),
    frequency: () => hertz,
  });

  it('lays its wavefronts a wavelength apart, c/f: about 3,000 km at 100 Hz', () => {
    const span = { from: -3, to: 3, bins: 6001 };
    const table = pathTable(tone(100), 0, span);
    const crossings: number[] = [];
    for (let index = 1; index < span.bins; index += 1) {
      if (Math.sign(table[2 * index] ?? 0) !== Math.sign(table[2 * (index - 1)] ?? 0)) {
        crossings.push(span.from + ((span.to - span.from) * index) / (span.bins - 1));
      }
    }
    const halfWavelengths =
      ((crossings.at(-1) ?? 0) - (crossings[0] ?? 0)) / (crossings.length - 1);
    expect(2 * halfWavelengths * 6371).toBeCloseTo(299_792.458 / 100, -1);
  });

  it('meets each place as Livingston did, earlier or later by how far along the path it lies', () => {
    const k = arrivalDirection();
    const along = k[0] * LIVINGSTON[0] + k[1] * LIVINGSTON[1] + k[2] * LIVINGSTON[2];
    const span = { from: along, to: along + 1, bins: 2 };
    const wave = tone(7);
    const table = pathTable(wave, 0.123, span, k);
    expect(table[0]).toBeCloseTo(wave.at(0.123).plus, 6);
    expect(table[1]).toBeCloseTo(wave.at(0.123).cross, 6);
  });

  it('lays the pairs out as asked, stretched, and gives none past the ends', () => {
    const table = pathTable(tone(7), 0, { from: -1, to: 1, bins: 3 }, arrivalDirection(), {
      stride: 4,
      scale: 10,
    });
    expect(table).toHaveLength(12);
    const middle = pairAt(table, 1, 4);
    expect(Math.hypot(middle.plus, middle.cross)).toBeCloseTo(10, 5);
    expect(pairAt(table, 3, 4)).toEqual({ plus: 0, cross: 0 });
  });
});
