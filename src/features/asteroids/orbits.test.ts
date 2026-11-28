import { describe, expect, it } from 'vitest';

import data from '../../../public/data/asteroids.json';
import reference from '../../../test-vectors/asteroids.json';
import { SOURCES } from '../../sources/registry';
import { asteroidPosition, BODY_GROUPS, isNamed, loadAsteroids } from './orbits';

const file = JSON.stringify(data);
const serve = (body: string) => () => Promise.resolve(new Response(body));
const belt = await loadAsteroids('asteroids.json', serve(file));
const AU = 149_597_870.7;

function named(name: string) {
  const found = belt.asteroids.find((each) => each.name === name);
  if (found === undefined) throw new Error(`no ${name}`);
  return found;
}

/** The angle between two directions from the Sun, degrees. */
function apart(a: readonly number[], b: readonly number[]): number {
  const [ax = 0, ay = 0, az = 0] = a;
  const [bx = 0, by = 0, bz = 0] = b;
  const cross = Math.hypot(ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx);
  return (Math.atan2(cross, ax * bx + ay * by + az * bz) * 180) / Math.PI;
}

/**
 * How far from JPL's place each may be, degrees seen from the Sun, within the years its orbit
 * is fitted to. Ceres and Vesta, little swung by Jupiter, within half a degree; Pallas and
 * Hygiea within some two; Eros (433) within half; Hektor (624), a Trojan swung about its
 * place ahead of Jupiter, within a few; Chiron (2060), turned by Saturn, within a few across
 * 1800 to 2100. Pluto (134340), Eris (136199) and Sedna (90377), fitted about the Solar
 * System's centre of mass and drawn about the Sun, within a fifth of a degree.
 */
const WITHIN: Readonly<Record<keyof typeof reference.asteroids, number>> = {
  '1': 0.5,
  '2': 2.5,
  '4': 0.5,
  '10': 2.5,
  '433': 0.5,
  '624': 3.5,
  '2060': 3,
  '134340': 0.2,
  '136199': 0.2,
  '90377': 0.2,
};

describe('the asteroids and dwarf planets, against JPL Horizons', () => {
  for (const [number, within] of Object.entries(WITHIN)) {
    it(`Given body ${number}’s mean orbit, Then it is within ${String(within)}° of JPL’s place, in the years fitted`, () => {
      const asteroid = belt.asteroids.find((each) => each.number === number);
      expect(asteroid).toBeDefined();
      if (asteroid === undefined) return;
      const moments = reference.asteroids[number as keyof typeof WITHIN];
      expect(moments).toHaveLength(24);
      for (const { jdTT, x, y, z } of moments) {
        expect(jdTT).toBeGreaterThanOrEqual(asteroid.fittedJdTT[0]);
        expect(jdTT).toBeLessThanOrEqual(asteroid.fittedJdTT[1]);
        expect(apart(asteroidPosition(asteroid, jdTT), [x, y, z])).toBeLessThan(within);
      }
    });
  }

  it('Given the file, Then the largest is first: Pluto, then Eris, and Ceres leads the main belt', () => {
    expect(belt.asteroids.slice(0, 2).map((each) => each.name)).toEqual(['Pluto', 'Eris']);
    const mainBelt = belt.asteroids.filter((each) => each.group === 'main-belt');
    expect(mainBelt.length).toBeGreaterThan(200);
    expect(mainBelt[0]?.name).toBe('Ceres');
  });

  it('Given the main belt and the Trojans, Then each is at least as wide as the file says they start at', () => {
    const listed = belt.asteroids.filter(
      (each) => each.group === 'main-belt' || each.group === 'trojan',
    );
    expect(listed.every((each) => each.diameterKm >= belt.smallestKm)).toBe(true);
    expect(listed.every((each) => each.sized === 'jplSbdb' && each.about === 'sun')).toBe(true);
    expect(listed.every((each) => each.fittedJdTT.join() === '2305448.5,2634166.5')).toBe(true);
  });

  it('Given every group, Then each has a body, from the near-Earth asteroids out to Sedna', () => {
    for (const group of BODY_GROUPS) {
      expect(belt.asteroids.some((each) => each.group === group)).toBe(true);
    }
    expect(named('Eros').group).toBe('near-earth');
    expect(named('Hektor').group).toBe('trojan');
    expect(named('Chiron').group).toBe('centaur');
    expect(named('Pluto').group).toBe('kuiper-belt');
    expect(named('Eris').group).toBe('scattered-disc');
    expect(named('Sedna').group).toBe('detached');
  });

  it('Given the IAU’s five dwarf planets, Then those and no others are marked', () => {
    const dwarfs = belt.asteroids.filter((each) => each.dwarfPlanet === true);
    expect(dwarfs.map((each) => each.name).sort()).toEqual([
      'Ceres',
      'Eris',
      'Haumea',
      'Makemake',
      'Pluto',
    ]);
  });

  it('Given a body beyond Neptune, Then it is fitted about the centre of mass; nearer ones about the Sun', () => {
    for (const each of belt.asteroids) {
      const beyond = ['kuiper-belt', 'scattered-disc', 'detached'].includes(each.group);
      expect(each.about).toBe(beyond ? 'barycentre' : 'sun');
    }
  });

  it('Given each body’s size, Then the source it is from is one the site credits', () => {
    for (const each of belt.asteroids) expect(Object.keys(SOURCES)).toContain(each.sized);
  });

  it('Given Vesta, Then it goes round between Mars and Jupiter, 2.36 AU out', () => {
    const [x, y, z] = asteroidPosition(named('Vesta'), 2451545);
    expect(Math.hypot(x, y, z) / AU).toBeGreaterThan(2.1);
    expect(Math.hypot(x, y, z) / AU).toBeLessThan(2.6);
  });

  it('Given Hektor at J2000, Then it is at Jupiter’s distance from the Sun', () => {
    const [x, y, z] = asteroidPosition(named('Hektor'), 2451545);
    expect(Math.hypot(x, y, z) / AU).toBeGreaterThan(4.9);
    expect(Math.hypot(x, y, z) / AU).toBeLessThan(5.5);
  });

  it('Given Sedna, the most stretched orbit drawn, Then in 2025 it is some 84 AU out, nearing its closest', () => {
    const sedna = named('Sedna');
    expect(sedna.eccentricity).toBeGreaterThan(0.8);
    const [x, y, z] = asteroidPosition(sedna, 2460686);
    expect(Math.hypot(x, y, z) / AU).toBeGreaterThan(80);
    expect(Math.hypot(x, y, z) / AU).toBeLessThan(86);
  });

  it('Given the crowded groups, Then only their largest are named; the chosen few always are', () => {
    expect(isNamed(named('Ceres'))).toBe(true);
    expect(isNamed(named('Hektor'))).toBe(true);
    expect(isNamed({ group: 'main-belt', diameterKm: 146 })).toBe(false);
    expect(isNamed({ group: 'trojan', diameterKm: 140 })).toBe(false);
    expect(isNamed(named('Itokawa'))).toBe(true);
    expect(isNamed(named('Arrokoth'))).toBe(true);
  });

  it('Given a file whose asteroid has no name, Then it is refused', async () => {
    const bad = JSON.parse(file) as { asteroids: Record<string, { name: string }> };
    const ceres = bad.asteroids['1'];
    if (ceres !== undefined) ceres.name = '';
    await expect(loadAsteroids('asteroids.json', serve(JSON.stringify(bad)))).rejects.toThrow();
  });

  it('Given a file whose body is in no known group, or fitted to years that run backwards, Then it is refused', async () => {
    const bad = JSON.parse(file) as { asteroids: Record<string, { group: string }> };
    const ceres = bad.asteroids['1'];
    if (ceres !== undefined) ceres.group = 'oort-cloud';
    await expect(loadAsteroids('asteroids.json', serve(JSON.stringify(bad)))).rejects.toThrow();
    const back = JSON.parse(file) as { asteroids: Record<string, { fittedJdTT: number[] }> };
    const vesta = back.asteroids['4'];
    if (vesta !== undefined) vesta.fittedJdTT = [2634166.5, 2305448.5];
    await expect(loadAsteroids('asteroids.json', serve(JSON.stringify(back)))).rejects.toThrow();
  });
});
