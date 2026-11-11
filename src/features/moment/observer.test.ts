import { describe, expect, it } from 'vitest';

import type { MoonEphemeris } from '../../astro/moon';
import type { FamousEclipse } from '../../data/famousEclipses';
import { CULTURE_INFO } from '../../data/skyCultures';
import { DEFAULT_CAMERA, defaultViewState, type ViewState } from '../../state/viewState';
import { julianDayNumber, type JulianDay } from '../../time/julianDay';
import { bodiesSeen, namedPlace, observerOf, placeName } from './observer';

const base = defaultViewState(new Date('2026-01-01T00:00:00Z'));
const athens = { latitude: 37.97, longitude: 23.72 };

describe('observerOf', () => {
  it('stands at the place picked, or the middle of Earth in view', () => {
    expect(observerOf({ ...base, location: athens })).toBe(athens);
    expect(observerOf(base)).toBe(base.camera.target);
    expect(observerOf({ ...base, focus: 'mars' })).toBe(DEFAULT_CAMERA.target);
  });
});

describe('placeName', () => {
  const site = Object.values(CULTURE_INFO).find((info) => info.place !== null)?.place;

  it("names a culture's site, standing right there", () => {
    expect(site).toBeDefined();
    if (site === undefined || site === null) return;
    expect(namedPlace(site)).toBe(site.name);
    expect(placeName(site, undefined)).toBe(site.name);
    expect(namedPlace({ latitude: 0, longitude: 0 })).toBeNull();
  });

  it("names a famous eclipse's place first, standing right there", () => {
    const famous = { place: { ...athens, name: 'Athens' } } as unknown as FamousEclipse;
    expect(placeName(athens, famous)).toBe('Athens');
    expect(placeName({ latitude: 0, longitude: 0 }, famous)).toBeNull();
  });
});

describe('bodiesSeen', () => {
  const plusOneMinute = (jd: JulianDay): JulianDay => julianDayNumber(jd + 1 / 1440);
  const state: ViewState = { ...base, location: athens };

  it('gives the Sun from the observer, and the Moon once its ephemeris is in', () => {
    const seen = bodiesSeen(state, plusOneMinute, null);
    expect(seen?.place).toBe(athens);
    expect(seen?.moon).toBeNull();
    expect(Math.hypot(...(seen?.sun ?? [0, 0, 0]))).toBeGreaterThan(1.4e8);
    const moon = { position: () => [384_400, 0, 0] } as unknown as MoonEphemeris;
    expect(bodiesSeen(state, plusOneMinute, moon)?.moon).toEqual([384_400, 0, 0]);
  });

  it('gives nothing beyond ΔT’s reach', () => {
    const beyond = (): JulianDay => {
      throw new RangeError('beyond ΔT');
    };
    expect(bodiesSeen(state, beyond, null)).toBeNull();
  });
});
