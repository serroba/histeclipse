import { describe, expect, it } from 'vitest';

import type { Asteroid } from './orbits';
import { asteroidCard } from './card';

const FULL = [2305448.5, 2634166.5] as const;

/** Ceres, roughly: 2.77 AU out, round in 4.6 years. */
const CERES: Asteroid = {
  number: '1',
  name: 'Ceres',
  group: 'main-belt',
  dwarfPlanet: true,
  diameterKm: 939.4,
  sized: 'jplSbdb',
  about: 'sun',
  fittedJdTT: [...FULL],
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

/** Sedna, roughly: 506 AU out on average, 76 at its nearest, round in some 11,400 years. */
const SEDNA: Asteroid = {
  ...CERES,
  number: '90377',
  name: 'Sedna',
  group: 'detached',
  dwarfPlanet: undefined,
  diameterKm: 995,
  sized: 'pal2012',
  about: 'barycentre',
  offDegrees: 0.01,
  axisKm: 506 * 149_597_870.7,
  eccentricity: 0.85,
  longitude: [100, 360 / (11_400 * 365.25), 0],
};

/** Chiron, a centaur fitted to 1800–2100 only. */
const CHIRON: Asteroid = {
  ...CERES,
  number: '2060',
  name: 'Chiron',
  group: 'centaur',
  dwarfPlanet: undefined,
  diameterKm: 166,
  fittedJdTT: [2378496.5, 2488069.5],
  offDegrees: 1.93,
};

const fact = (card: ReturnType<typeof asteroidCard>, label: string) =>
  card.facts.find(([each]) => each === label)?.[1];

describe('a small body’s card', () => {
  it('Given Ceres in 2025, Then it says what it is, its size, its orbit and how close its place is', () => {
    const card = asteroidCard(CERES, 2460686);
    expect(card.title).toBe('Ceres');
    expect(fact(card, 'What')).toBe(
      'Dwarf planet, one of the five the IAU names · Main-belt asteroid, between Mars and Jupiter',
    );
    expect(card.facts).toContainEqual(['Across', '939 km']);
    expect(card.facts).toContainEqual([
      'Orbit',
      '2.77 AU from the Sun on average (2.55 to 2.99), once round every 4.6 years',
    ]);
    expect(card.facts).toContainEqual(['Minor planet', 'number 1']);
    expect(card.facts).toContainEqual([
      'Where',
      'Within 0.4° of JPL’s place along its orbit, seen from the Sun',
    ]);
    expect(card.links).toEqual([
      {
        label: 'JPL Small-Body Database',
        href: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1',
      },
    ]);
    expect(card.note).toMatch(/^Size: JPL’s Small-Body Database/);
  });

  it('Given Ceres in 1000 CE, before the years fitted, Then its place is only rough, and the years are named', () => {
    const where = fact(asteroidCard(CERES, 2086308), 'Where');
    expect(where).toMatch(/^Roughly: its orbit is fitted to JPL’s from 1600 to 2500/);
  });

  it('Given Chiron in 1700, Then its own fewer years are named', () => {
    const card = asteroidCard(CHIRON, 2341973);
    expect(fact(card, 'What')).toBe('Centaur, among the giant planets');
    expect(fact(card, 'Where')).toMatch(/fitted to JPL’s from 1800 to 2100/);
    expect(fact(asteroidCard(CHIRON, 2460686), 'Where')).toMatch(/^Within 1\.9°/);
  });

  it('Given Sedna, Then its far orbit is told in whole numbers, and its size is credited to its paper', () => {
    const card = asteroidCard(SEDNA, 2460686);
    expect(fact(card, 'What')).toBe('Detached: even at its nearest to the Sun, far beyond Neptune');
    expect(fact(card, 'Orbit')).toBe(
      '506 AU from the Sun on average (75.9 to 936), once round every 11,400 years',
    );
    expect(card.links[1]?.label).toMatch(/^Its size: /);
    expect(card.links[1]?.href).toMatch(/^https:\/\/doi\.org\//);
    expect(card.note).not.toMatch(/JPL’s Small-Body Database/);
  });

  it('Given a body under ten kilometres, or under one, Then its size is told finer', () => {
    expect(fact(asteroidCard({ ...CERES, diameterKm: 0.33 }, 2460686), 'Across')).toBe('330 m');
    expect(fact(asteroidCard({ ...CERES, diameterKm: 8.44 }, 2460686), 'Across')).toBe('8.4 km');
  });

  it('Given a size from a source the registry does not know, Then the card still opens', () => {
    const card = asteroidCard({ ...SEDNA, sized: 'nobody2099' }, 2460686);
    expect(card.links).toHaveLength(1);
    expect(card.note).toMatch(/^Size: its own source/);
  });
});
