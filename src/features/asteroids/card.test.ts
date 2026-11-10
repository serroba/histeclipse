import { describe, expect, it } from 'vitest';

import type { AsteroidOrbit } from './orbits';
import { asteroidCard } from './card';

/** Ceres, roughly: 2.77 AU out, round in 4.6 years. */
const CERES: AsteroidOrbit & { readonly number: string } = {
  number: '1',
  name: 'Ceres',
  diameterKm: 939.4,
  offDegrees: 0.37,
  axisKm: 414_000_000,
  eccentricity: 0.08,
  inclination: 10,
  longitude: [150, 0.2141, 0],
  swings: [],
  pericentre: [150, 0],
  node: [80, 0],
  pole: [270, 66.56],
};
const FITTED = [2305448.5, 2634166.5] as const;

describe('an asteroid’s card', () => {
  it('Given Ceres in 2025, Then it says its size, its orbit and how close its place is', () => {
    const card = asteroidCard(CERES, FITTED, 2460686);
    expect(card.title).toBe('Ceres');
    expect(card.facts).toContainEqual(['Across', '939 km']);
    expect(card.facts).toContainEqual([
      'Orbit',
      '2.77 AU from the Sun on average, once round every 4.6 years',
    ]);
    expect(card.facts).toContainEqual(['Minor planet', 'number 1']);
    expect(card.facts).toContainEqual([
      'Where',
      'Within 0.4° of JPL’s place along its orbit, seen from the Sun',
    ]);
    expect(card.links[0]?.href).toBe('https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1');
  });

  it('Given Ceres in 1000 CE, before the years fitted, Then its place is only rough', () => {
    const card = asteroidCard(CERES, FITTED, 2086308);
    const where = card.facts.find(([label]) => label === 'Where');
    expect(where?.[1]).toMatch(/^Roughly/);
  });
});
