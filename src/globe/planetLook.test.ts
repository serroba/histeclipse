import { describe, expect, it } from 'vitest';

import { PLANETS, saturnRingTilt } from '../astro/planets';
import {
  bodyAxes,
  colourAt,
  MOON_CAPTION,
  primeMeridian,
  PLANET_NAMES,
  PLANET_PICTURES,
  PLANET_VIEWS,
  planetView,
  planetRadius,
  poleVector,
  polarRatio,
  ringOpacity,
  SATURN_RINGS_KM,
} from './planetLook';

describe('planet sizes and shapes', () => {
  it('are true to scale in Earth radii', () => {
    expect(planetRadius('jupiter')).toBeCloseTo(11.21, 2);
    expect(planetRadius('mercury')).toBeCloseTo(0.383, 3);
    expect(polarRatio('saturn')).toBeCloseTo(0.902, 3);
    expect(polarRatio('venus')).toBe(1);
  });

  it('point Saturn’s pole where the ring tilt is computed from', () => {
    const [x, y, z] = poleVector('saturn');
    expect(Math.hypot(x, y, z)).toBeCloseTo(1, 12);
    // Saturn placed along its own pole from us: we look up at the rings' south face.
    expect(saturnRingTilt([x * 1e9, y * 1e9, z * 1e9])).toBeCloseTo(-90, 6);
  });

  it('are named for every planet', () => {
    expect(PLANETS.map((planet) => PLANET_NAMES[planet])).toEqual([
      'Mercury',
      'Venus',
      'Mars',
      'Jupiter',
      'Saturn',
    ]);
  });
});

describe('planet colours', () => {
  it('band Jupiter dark in its belts and light in its zones', () => {
    expect(colourAt('jupiter', 12)).not.toBe(colourAt('jupiter', 0));
    expect(colourAt('jupiter', 0)).toBe(colourAt('jupiter', 21));
    expect(colourAt('mars', 85)).not.toBe(colourAt('mars', 0));
    expect(colourAt('venus', 40)).toBe(colourAt('venus', -40));
  });
});

describe('Saturn’s rings', () => {
  it('are dense in the B ring, thin in the C ring and the gaps, and absent outside', () => {
    expect(ringOpacity(SATURN_RINGS_KM.inner - 1)).toBe(0);
    expect(ringOpacity(SATURN_RINGS_KM.outer + 1)).toBe(0);
    expect(ringOpacity(80_000)).toBeLessThan(0.2);
    expect(ringOpacity(100_000)).toBeGreaterThan(0.8);
    expect(ringOpacity(120_000)).toBeLessThan(0.1);
    expect(ringOpacity(133_589)).toBeLessThan(0.1);
    expect(ringOpacity(128_000)).toBeGreaterThan(0.5);
  });
});

describe('planet views, for the Light switch', () => {
  it('starts each planet as it looks, and gives Venus its radar ground', () => {
    for (const planet of PLANETS) {
      const [first] = PLANET_VIEWS[planet];
      expect(first?.caption).toBe(PLANET_PICTURES[planet].caption);
    }
    expect(PLANET_VIEWS.venus.map(({ key }) => key)).toEqual(['clouds', 'radar']);
    expect(planetView('venus', 'radar').map).toBe('textures/planets/venus-radar-2048.jpg');
    expect(planetView('venus', 'radar').caption).toContain('Magellan');
    // A key a planet does not have, or none, falls back to how it looks.
    expect(planetView('venus', '').key).toBe('clouds');
    expect(planetView('mars', 'radar').key).toBe('colour');
  });
});

describe('planet pictures', () => {
  it('wrap the missions’ maps where one is used, and say whose they are', () => {
    const mapped = PLANETS.filter((planet) => PLANET_PICTURES[planet].map !== null);
    expect(mapped).toEqual(['mercury', 'mars', 'jupiter', 'saturn']);
    for (const planet of mapped) {
      expect(PLANET_PICTURES[planet].map).toBe(`textures/planets/${planet}-2048.jpg`);
      expect(PLANET_PICTURES[planet].caption).toMatch(/(NASA|USGS)[^.]*\.$/);
    }
    expect(MOON_CAPTION).toContain('NASA');
  });

  it('say so where the painted colours stand in', () => {
    expect(PLANET_PICTURES.venus.caption).toContain('clouds hide the ground');
    expect(PLANET_PICTURES.saturn.caption).toContain('not imaged, are filled');
  });
});

describe('how the planets turn', () => {
  const AU = 149_597_870.7;
  /** Where on the planet the middle of its disc is, seen from Earth: east longitude, latitude. */
  const subEarth = (
    planet: 'mars' | 'jupiter',
    jdTT: number,
    ra: number,
    dec: number,
    au: number,
  ): [number, number] => {
    const r = Math.PI / 180;
    // From the planet toward Earth: the reverse of where Earth sees it.
    const v = [
      -Math.cos(dec * r) * Math.cos(ra * r),
      -Math.cos(dec * r) * Math.sin(ra * r),
      -Math.sin(dec * r),
    ];
    const { pole, prime, east } = bodyAxes(planet, jdTT, au * AU);
    const dot = (a: readonly number[]) => a.reduce((sum, x, i) => sum + x * (v[i] ?? 0), 0);
    const longitude = (((Math.atan2(dot(east), dot(prime)) / r) % 360) + 360) % 360;
    return [longitude, Math.asin(dot(pole)) / r];
  };
  // JPL Horizons, 2026-01-10 12:00 TT, from Earth's centre: RA, Dec (ICRF), distance, and the
  // sub-observer point (west longitude, as Horizons gives it for these planets).
  const jd = 2_461_051;

  it('turns Mars as JPL Horizons has it: the same face toward Earth', () => {
    const [longitude, latitude] = subEarth('mars', jd, 291.39973, -22.93598, 2.40246742);
    expect(longitude).toBeCloseTo(360 - 285.451899, 1);
    // Horizons gives the latitude planetodetic (to the flattened surface's normal), this one
    // planetocentric: they differ by a few tenths of a degree.
    expect(latitude).toBeCloseTo(-10.953252, 0);
  });

  it('turns Jupiter by System III, light time and all', () => {
    const [longitude, latitude] = subEarth('jupiter', jd, 111.37843, 22.24624, 4.23189956);
    expect(longitude).toBeCloseTo(360 - 327.390203, 1);
    expect(latitude).toBeCloseTo(1.589517, 0);
  });

  it('counts the light’s time: Jupiter some 20° less turned than at the moment itself', () => {
    const now = primeMeridian('jupiter', jd);
    const seen = primeMeridian('jupiter', jd, 4.23 * AU);
    expect((((now - seen) % 360) + 360) % 360).toBeGreaterThan(20);
    expect((((now - seen) % 360) + 360) % 360).toBeLessThan(22);
  });

  it('has Venus turning backward, slowly', () => {
    expect(primeMeridian('venus', 2_451_545)).toBeCloseTo(160.2, 6);
    expect(primeMeridian('venus', 2_451_546)).toBeCloseTo(160.2 - 1.4813688, 6);
  });
});
