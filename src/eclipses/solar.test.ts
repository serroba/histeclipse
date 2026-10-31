import { describe, expect, it } from 'vitest';

import type { SolarEclipse } from '../data/solarCatalog';
import { julianDayNumber } from '../time/julianDay';
import { localCircumstances, maximumEclipseAt, shadowAt } from './solar';

// The 21st century's solar eclipses, as the site serves them (the schema itself is tested with
// the catalog loader; here the records are used as data).
import century from '../../public/data/solar/2000.json';

const eclipses = century as unknown as SolarEclipse[];

function eclipseOn(year: number, month: number, day: number): SolarEclipse {
  const target = Date.UTC(year, month - 1, day) / 86_400_000 + 2_440_587.5;
  const found = eclipses.find((eclipse) => Math.abs(eclipse.jdTT - target - 0.5) < 1);
  if (found === undefined)
    throw new Error(`No solar eclipse on ${String(year)}-${String(month)}-${String(day)}`);
  return found;
}

const DALLAS = { latitude: 32.7767, longitude: -96.797 };
const CLEVELAND = { latitude: 41.4993, longitude: -81.6944 };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };
const SAN_ANTONIO = { latitude: 29.4241, longitude: -98.4936 };
const SYDNEY = { latitude: -33.8688, longitude: 151.2093 };

const APRIL_2024 = eclipseOn(2024, 4, 8);
const OCTOBER_2023 = eclipseOn(2023, 10, 14);

describe('local circumstances', () => {
  it.each([
    ['Dallas', DALLAS],
    ['Cleveland', CLEVELAND],
  ])('puts %s in the path of totality on 2024 April 8', (_name, place) => {
    expect(
      maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, place)?.circumstances.phase,
    ).toBe('total');
  });

  it('gives New York a deep partial eclipse on 2024 April 8', () => {
    const maximum = maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, NEW_YORK);
    expect(maximum?.circumstances.phase).toBe('partial');
    expect(maximum?.circumstances.magnitude).toBeGreaterThan(0.85);
    expect(maximum?.circumstances.magnitude).toBeLessThan(0.97);
  });

  it('puts San Antonio in the 2023 annular path', () => {
    expect(
      maximumEclipseAt(OCTOBER_2023.elements, OCTOBER_2023.deltaT, SAN_ANTONIO)?.circumstances
        .phase,
    ).toBe('annular');
  });

  // NASA's path of totality for 2024 April 8 at 18:36 UT:
  // https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2024Apr08Tpath.html
  // northern limit 31°15.0′N 99°19.9′W, southern limit 29°56.0′N 98°00.1′W,
  // central line 30°35.4′N 98°39.9′W.
  it.each([
    ['on the central line', { latitude: 30.59, longitude: -98.665 }, 'total'],
    ['just inside the northern limit', { latitude: 31.2, longitude: -99.332 }, 'total'],
    ['just outside the northern limit', { latitude: 31.3, longitude: -99.332 }, 'partial'],
    ['just inside the southern limit', { latitude: 29.98, longitude: -98.002 }, 'total'],
    ['just outside the southern limit', { latitude: 29.88, longitude: -98.002 }, 'partial'],
  ] as const)('matches NASA’s 2024 path: a point %s sees a %s eclipse', (_where, place, phase) => {
    expect(
      maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, place)?.circumstances.phase,
    ).toBe(phase);
  });

  it('leaves downtown San Antonio just outside the 2024 path, as NASA’s limits show', () => {
    // NASA's southern limit crosses San Antonio's longitude at about 29.49°N; downtown is 29.42°N.
    const maximum = maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, SAN_ANTONIO);
    expect(maximum?.circumstances.phase).toBe('partial');
    expect(maximum?.circumstances.magnitude).toBeGreaterThan(0.99);
  });

  it('finds no eclipse where the shadow never reaches', () => {
    expect(maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, SYDNEY)).toBeNull();
  });

  it('reports the time of maximum eclipse', () => {
    const maximum = maximumEclipseAt(APRIL_2024.elements, APRIL_2024.deltaT, DALLAS);
    // Totality in Dallas was around 18:42 UT; TT is 69 s later.
    const utHours = (((maximum?.jdTT ?? 0) - APRIL_2024.deltaT / 86_400 + 0.5) % 1) * 24;
    expect(utHours).toBeGreaterThan(18.6);
    expect(utHours).toBeLessThan(18.8);
  });
});

describe('agreement with the pipeline', () => {
  // Central eclipses only: for non-central ones greatest eclipse is on the limb, with the Sun
  // exactly on the horizon.
  const central = eclipses.filter(
    (eclipse) => eclipse.kind !== 'partial' && Math.abs(eclipse.gamma) < 0.997,
  );

  it('covers the 21st century', () => {
    expect(eclipses.length).toBeGreaterThan(200);
    expect(central.length).toBeGreaterThan(100);
  });

  it('reproduces magnitude and type at every central eclipse’s point of greatest eclipse', () => {
    for (const eclipse of central) {
      const shadow = shadowAt(eclipse.elements, eclipse.jdTT, eclipse.deltaT);
      if (shadow === null) throw new Error('greatest eclipse outside its elements');
      const [latitude, longitude] = eclipse.greatest;
      const here = localCircumstances(shadow, { latitude, longitude });
      // The catalog rounds the place to 0.01°; that alone moves the magnitude slightly.
      expect(here.magnitude).toBeCloseTo(eclipse.magnitude, 2);
      const expected =
        eclipse.kind === 'total'
          ? ['total']
          : eclipse.kind === 'annular'
            ? ['annular']
            : ['total', 'annular'];
      expect(expected).toContain(here.phase);
    }
  });
});

describe('shadowAt', () => {
  it('refuses times outside the ±3 hours the elements cover', () => {
    const t0 = APRIL_2024.elements.t0;
    expect(shadowAt(APRIL_2024.elements, julianDayNumber(t0 + 3.1 / 24), 69)).toBeNull();
    expect(shadowAt(APRIL_2024.elements, julianDayNumber(t0 - 2.9 / 24), 69)).not.toBeNull();
  });

  it('applies ΔT to the hour angle at Earth’s sidereal rate', () => {
    const jd = APRIL_2024.jdTT;
    const a = shadowAt(APRIL_2024.elements, jd, 0);
    const b = shadowAt(APRIL_2024.elements, jd, 100);
    expect((a?.mu ?? 0) - (b?.mu ?? 0)).toBeCloseTo((100 * 360 * 1.002737909) / 86_400, 9);
  });

  it('reports no eclipse where the Sun is down', () => {
    const shadow = shadowAt(APRIL_2024.elements, APRIL_2024.jdTT, APRIL_2024.deltaT);
    if (shadow === null) throw new Error('missing shadow');
    expect(localCircumstances(shadow, SYDNEY)).toEqual({
      phase: 'none',
      magnitude: 0,
      sunUp: false,
    });
  });
});
