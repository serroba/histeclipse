import { describe, expect, it } from 'vitest';

import { PLANETS, saturnRingTilt } from '../astro/planets';
import {
  colourAt,
  PLANET_NAMES,
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
