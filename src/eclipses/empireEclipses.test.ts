import { describe, expect, it } from 'vitest';

import lunarBce600 from '../../public/data/lunar/-600.json';
import solarBce600 from '../../public/data/solar/-600.json';
import { greatestEclipseUT, yearOf } from '../data/catalog';
import type { Territory } from '../data/empires';
import type { LunarEclipse } from '../data/lunarCatalog';
import type { SolarEclipse } from '../data/solarCatalog';
import { createEmpireEclipses, SEARCH_YEARS } from './empireEclipses';

const all = [
  ...(lunarBce600 as unknown as LunarEclipse[]),
  ...(solarBce600 as unknown as SolarEclipse[]),
].sort((a, b) => a.jdTT - b.jdTT);
const inYear = (year: number) =>
  all.filter((eclipse) => yearOf(greatestEclipseUT(eclipse)) === year);

// A square around Babylon, the same object every year so its region is prepared once.
const BABYLON: Territory = {
  name: 'Babylonia',
  wikipedia: '',
  rings: [
    [
      [42, 31],
      [47, 31],
      [47, 35],
      [42, 35],
      [42, 31],
    ],
  ],
};

function sources(from: number, to: number) {
  const asked: number[] = [];
  return {
    asked,
    sources: {
      territory: (name: string, year: number) => {
        asked.push(year);
        return Promise.resolve(name === 'Babylonia' && year >= from && year <= to ? BABYLON : null);
      },
      eclipses: (year: number) =>
        Promise.resolve(year >= -600 && year < -500 ? inYear(year) : null),
      uncertainty: () => 600,
    },
  };
}

describe('eclipses seen from a state', () => {
  it('mark each of a year’s eclipses, or nothing when the state is not on the map', async () => {
    const { sources: fake } = sources(-625, -539);
    const finder = createEmpireEclipses(fake);
    const eclipses = inYear(-586);
    const marks = await finder.seenInYear('Babylonia', -586, eclipses);
    expect(marks?.size).toBe(eclipses.length);
    expect([...(marks?.values() ?? [])].some((seen) => seen.verdict !== 'not')).toBe(true);
    expect(await finder.seenInYear('Babylonia', -520, inYear(-520))).toBeNull();
    expect(await finder.seenInYear('Persia', -586, eclipses)).toBeNull();
  });

  it('find the nearest year with one, either way, within the state’s years', async () => {
    const { sources: fake } = sources(-590, -580);
    const finder = createEmpireEclipses(fake);
    const next = await finder.nearest('Babylonia', -586, 1);
    expect(next?.year).toBeGreaterThan(-586);
    expect(next?.seen.verdict).not.toBe('not');
    const previous = await finder.nearest('Babylonia', -586, -1);
    expect(previous?.year).toBeLessThan(-586);
    expect(previous?.year).toBeGreaterThanOrEqual(-590);
  });

  it('stop at the end of the catalog, or after looking far enough', async () => {
    const { sources: fake } = sources(-4000, 3000);
    expect(await createEmpireEclipses(fake).nearest('Nowhere', -550, 1)).toBeNull();
    const { sources: endless, asked } = sources(-4000, 3000);
    const finder = createEmpireEclipses({ ...endless, eclipses: () => Promise.resolve([]) });
    expect(await finder.nearest('Babylonia', 0, -1)).toBeNull();
    expect(asked).toHaveLength(SEARCH_YEARS);
  });
});
