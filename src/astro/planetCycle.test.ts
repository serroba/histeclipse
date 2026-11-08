import earth from 'astronomia/data/vsop87Bearth';
import jupiter from 'astronomia/data/vsop87Bjupiter';
import mars from 'astronomia/data/vsop87Bmars';
import mercury from 'astronomia/data/vsop87Bmercury';
import saturn from 'astronomia/data/vsop87Bsaturn';
import venus from 'astronomia/data/vsop87Bvenus';
import { Planet } from 'astronomia/planetposition';
import { describe, expect, it } from 'vitest';

import { planetCycle, sunCycle, SYNODIC_DAYS, type BodyCycle } from './planetCycle';
import type { EquatorialVector } from './moon';
import { createPlanetEphemeris, PLANETS, type PlanetEphemeris } from './planets';

const ephemeris = createPlanetEphemeris({ earth, mercury, venus, mars, jupiter, saturn }, Planet);

/** A Gregorian date as a Julian Day (TT and UT differ by about a minute today). */
function jd(date: string): number {
  return Date.parse(`${date}T00:00Z`) / 86_400_000 + 2_440_587.5;
}

/** The cycle's events as marks and dates, to the day. */
function dated(cycle: BodyCycle): readonly string[] {
  return cycle.events.map(
    ({ mark, jdTT }) =>
      `${mark} ${new Date((jdTT - 2_440_587.5) * 86_400_000).toISOString().slice(0, 10)}`,
  );
}

describe('a body’s cycle as Earth sees it, against the published dates', () => {
  it('Given 10 January 2025, Then Mars runs from conjunction to conjunction, opposite the Sun on 16 January', () => {
    expect(dated(planetCycle(ephemeris, 'mars', jd('2025-01-10')))).toEqual([
      'behind 2023-11-18',
      'opposite 2025-01-16',
      'behind 2026-01-09',
    ]);
  });

  it('Given 1 March 2025, Then Venus shows best in the evening, passes between us and the Sun, then best in the morning', () => {
    expect(dated(planetCycle(ephemeris, 'venus', jd('2025-03-01')))).toEqual([
      'behind 2024-06-04',
      'evening 2025-01-10',
      'between 2025-03-23',
      'morning 2025-06-01',
      'behind 2026-01-06',
    ]);
  });

  it('Given 1 July 2025, Then Mercury’s short cycle is the one around it', () => {
    expect(dated(planetCycle(ephemeris, 'mercury', jd('2025-07-01')))).toEqual([
      'behind 2025-05-30',
      'evening 2025-07-04',
      'between 2025-07-31',
      'morning 2025-08-19',
      'behind 2025-09-13',
    ]);
  });

  it('Given the dates in the app’s own journeys, Then Jupiter and Saturn are opposite the Sun on theirs', () => {
    expect(dated(planetCycle(ephemeris, 'jupiter', jd('2026-01-10')))[1]).toBe(
      'opposite 2026-01-10',
    );
    expect(dated(planetCycle(ephemeris, 'saturn', jd('2025-09-01')))[1]).toBe(
      'opposite 2025-09-21',
    );
  });

  it('Given 1 March 2025, Then the Sun’s cycle is Earth’s year, perihelion on 4 January and aphelion on 3 July (and 3 January next)', () => {
    expect(dated(sunCycle(ephemeris, jd('2025-03-01')))).toEqual([
      'perihelion 2025-01-04',
      'aphelion 2025-07-03',
      'perihelion 2026-01-03',
    ]);
  });
});

describe('a cycle always holds the moment shown, back to the Holocene and on', () => {
  // Every 97 years and a bit from 9700 BCE, so the moments fall all around each cycle.
  const moments = Array.from({ length: 120 }, (_, index) => jd('2026-01-01') - index * 35_517.3);

  for (const planet of PLANETS) {
    it(`Given ${planet} at 120 moments, Then each cycle holds its moment and lasts about a synodic period`, () => {
      for (const moment of moments) {
        const cycle = planetCycle(ephemeris, planet, moment);
        expect(cycle.start).toBeLessThanOrEqual(moment);
        expect(cycle.end).toBeGreaterThan(moment);
        const days = cycle.end - cycle.start;
        expect(Math.abs(days / SYNODIC_DAYS[planet] - 1)).toBeLessThan(0.3);
        const times = cycle.events.map(({ jdTT }) => jdTT);
        expect(times).toEqual([...times].sort((a, b) => a - b));
      }
    }, 30_000);
  }

  it('Given the Sun at 120 moments, Then each year holds its moment, perihelion to perihelion', () => {
    for (const moment of moments) {
      const cycle = sunCycle(ephemeris, moment);
      expect(cycle.start).toBeLessThanOrEqual(moment);
      expect(cycle.end).toBeGreaterThan(moment);
      expect(Math.abs(cycle.end - cycle.start - 365.26)).toBeLessThan(3);
    }
  });

  it('Given a moment right at a conjunction, Then the cycle starts or ends there', () => {
    const { end } = planetCycle(ephemeris, 'mars', jd('2025-01-10'));
    for (const moment of [end - 1e-3, end, end + 1e-3]) {
      const cycle = planetCycle(ephemeris, 'mars', moment);
      expect(cycle.start).toBeLessThanOrEqual(moment);
      expect(cycle.end).toBeGreaterThan(moment);
      expect(Math.min(Math.abs(cycle.start - end), Math.abs(cycle.end - end))).toBeLessThan(1e-3);
    }
  });
});

describe('the searches recover when the mean rate guesses wrong', () => {
  const AU = 149_597_870.7;
  /** A body on a circle in the ecliptic, at an angle (radians) and distance (AU). */
  const at = (angle: number, au: number): EquatorialVector => [
    au * AU * Math.cos(angle),
    au * AU * Math.sin(angle),
    0,
  ];
  // Mars far from uniform (its angle swings a whole radian about the mean), and an Earth whose
  // distance from the Sun swings by a fifth, so the first guesses land wide of the mark.
  const lopsided: Pick<PlanetEphemeris, 'heliocentric'> = {
    heliocentric(body, jd) {
      const year = (2 * Math.PI * jd) / 365.25;
      if (body === 'earth') return at(year, 1 - 0.2 * Math.cos(year));
      const orbit = (2 * Math.PI * jd) / 687;
      return at(orbit + Math.sin(orbit), 1.52);
    },
  };

  it('Given a lopsided Mars at 300 moments, Then each cycle still holds its moment', () => {
    for (let index = 0; index < 300; index++) {
      const moment = 2_460_000 + index * 13.7;
      const cycle = planetCycle(lopsided, 'mars', moment);
      expect(cycle.start).toBeLessThanOrEqual(moment);
      expect(cycle.end).toBeGreaterThan(moment);
    }
  });

  it('Given moments just around each perihelion, Then each year still holds its moment', () => {
    for (let index = 0; index < 40; index++) {
      const perihelion = 365.25 * (6730 + index);
      for (const moment of [perihelion - 0.01, perihelion + 0.0001, perihelion + 0.01]) {
        const cycle = sunCycle(lopsided, moment);
        expect(cycle.start).toBeLessThanOrEqual(moment);
        expect(cycle.end).toBeGreaterThan(moment);
      }
    }
  });
});
