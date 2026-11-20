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
import { GW170817_TRIP } from './trips';
import { directionFrom, directionOf, journeyParts, placeOf, siderealDegrees } from './journey';

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

describe('which way GW170817 came, and what was heard when (#993)', () => {
  const trip = GW170817_TRIP;
  const k = directionOf(trip);
  const centre: [number, number, number] = [0, 0, 0];
  const at = (detector: 'L1' | 'H1' | 'V1'): number => delayBetween(k, centre, placeOf(detector));

  it('reads sidereal time as the almanac does: 280.46° at noon on 1 January 2000', () => {
    expect(siderealDegrees(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(280.460_618_37, 6);
    // A sidereal day is 3 min 56 s shorter than a solar one.
    const day = siderealDegrees(new Date('2000-01-02T12:00:00Z'));
    expect(day - 280.460_618_37).toBeCloseTo(0.985_647, 4);
  });

  it('comes away from the place on Earth the source stood over', () => {
    const date = new Date('2000-01-01T12:00:00Z');
    // A source on the equator at the sidereal time's right ascension stands over 0° longitude.
    const way = directionFrom(280.460_618_37, 0, date);
    expect(way[0]).toBeCloseTo(-1, 9);
    expect(Math.hypot(way[1], way[2])).toBeCloseTo(0, 9);
    expect(directionOf(trip)).toBe(k);
  });

  it('reaches Virgo first, Livingston 22 ms later and Hanford 3 ms after, as the paper says', () => {
    expect(trip.heard).toEqual(['V1', 'L1', 'H1']);
    expect(at('L1') - at('V1')).toBeCloseTo(0.022, 3);
    expect(at('H1') - at('L1')).toBeCloseTo(0.003, 3);
    // Livingston 15.5 ms after Earth's middle: when the merger is placed there (`events.ts`).
    expect(at('L1')).toBeCloseTo(0.0155, 4);
  });

  it('counts down 130 million years, says who hears it in turn, then the gamma rays', () => {
    const parts = journeyParts(trip);
    expect(journeyText(journeyAt(0, 4.4155, trip), trip)).toBe(
      'Crossing space at the speed of light: 130 million years to go',
    );
    const said = new Set<string>();
    for (let ms = parts.travel; ms < parts.travel + parts.arrive; ms += 5) {
      said.add(journeyText(journeyAt(ms, 4.4155, trip), trip).replace(/^.* UTC · /, ''));
    }
    expect([...said]).toEqual([
      'reaching Earth',
      'Virgo hears it first',
      'Livingston hears it, 21.8 ms after Virgo',
      'Hanford hears it, 3.3 ms after Livingston',
    ]);
    const rest = journeyText(journeyAt(journeyMs(trip) - 1, 4.4155, trip), trip);
    expect(rest).toMatch(/^12:41:04\.4\d\d UTC · and 1\.7 s behind the wave/);
    expect(rest).toContain('GRB 170817A');
    expect(parts.rest).toBeGreaterThan(JOURNEY_MS.rest);
  });
});
