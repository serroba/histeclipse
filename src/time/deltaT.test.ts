import { describe, expect, it } from 'vitest';

import tableJson from '../../public/data/delta-t.json';
import { astronomicalYear } from './year';
import { DeltaT } from './deltaT';
import { julianDayNumber } from './julianDay';

const catalogChunks = import.meta.glob<{ jdTT: number; deltaT: number }[]>(
  '../../public/data/lunar/-*.json',
  { eager: true, import: 'default' },
);
const modernChunks = import.meta.glob<{ jdTT: number; deltaT: number }[]>(
  '../../public/data/lunar/[0-9]*.json',
  { eager: true, import: 'default' },
);

const deltaT = new DeltaT(tableJson);
const jdOfYear = (year: number) => julianDayNumber(2_451_545 + (year - 2000) * 365.25);

describe('DeltaT', () => {
  it('covers the catalog years with a year to spare on each side', () => {
    expect([deltaT.firstYear, deltaT.lastYear]).toEqual([-4000, 3001]);
  });

  it('agrees with the ΔT stored on every catalogued eclipse', () => {
    const eclipses = [...Object.values(catalogChunks), ...Object.values(modernChunks)].flat();
    expect(eclipses.length).toBeGreaterThan(16_000);
    for (const eclipse of eclipses) {
      // Catalog values are rounded to whole seconds.
      expect(Math.abs(deltaT.seconds(julianDayNumber(eclipse.jdTT)) - eclipse.deltaT)).toBeLessThan(
        0.6,
      );
    }
  });

  it.each([
    [2000, 63.83],
    [-620, 18_780.92],
  ])('returns the tabulated value at the start of %i', (year, seconds) => {
    expect(deltaT.seconds(jdOfYear(year))).toBeCloseTo(seconds, 2);
  });

  it('interpolates linearly between samples', () => {
    const table = {
      ...tableJson,
      startYear: 0,
      stepYears: 10,
      seconds: [100, 200, 400],
      uncertaintySeconds: [10, 20, 40],
    };
    const small = new DeltaT(table);
    expect(small.seconds(jdOfYear(5))).toBeCloseTo(150, 9);
    expect(small.seconds(jdOfYear(20))).toBeCloseTo(400, 9);
    expect(small.uncertaintySeconds(jdOfYear(15))).toBeCloseTo(30, 9);
  });

  it('reports uncertainty that grows into the past', () => {
    expect(deltaT.uncertaintySeconds(jdOfYear(-620))).toBeCloseTo(476, 0);
    expect(deltaT.uncertaintySeconds(jdOfYear(2000))).toBeLessThan(5);
  });

  it('converts between UT and TT', () => {
    const universal = jdOfYear(2025);
    const terrestrial = deltaT.terrestrialTime(universal);
    expect((terrestrial - universal) * 86_400).toBeCloseTo(69.14, 1);
    expect(deltaT.universalTime(terrestrial)).toBeCloseTo(universal, 9);
  });

  it('refuses to extrapolate', () => {
    expect(() => deltaT.seconds(jdOfYear(3001.5))).toThrow(/tabulated for -4000 to 3001/);
    expect(() => deltaT.seconds(jdOfYear(-4000.5))).toThrow(RangeError);
  });

  it('rejects malformed tables', () => {
    expect(() => new DeltaT({ ...tableJson, uncertaintySeconds: [1] })).toThrow(/same length/);
  });

  it('loads and validates the table over HTTP', async () => {
    const loaded = await DeltaT.load('/data/delta-t.json', () =>
      Promise.resolve(Response.json(tableJson)),
    );
    expect(loaded.seconds(jdOfYear(2000))).toBeCloseTo(63.83, 2);
    expect(astronomicalYear(loaded.firstYear)).toBe(-4000);
  });
});
