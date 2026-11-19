import { describe, expect, it } from 'vitest';

import file from '../../public/data/ocean-temperature/index.json';
import {
  depthFile,
  depthName,
  loadOceanTemperature,
  oceanText,
  sectionFile,
  shownMonth,
  type OceanTemperature,
} from './oceanTemperature';

const maps = file as unknown as OceanTemperature;
const month = (year: number, number: number): number => year * 12 + number - 1;
const [surface, hundred, deep] = maps.depths;

describe('the ocean’s temperature by depth (#590)', () => {
  it('Given the published index, Then it reads: three depths from 1940, and the section', async () => {
    const read = await loadOceanTemperature('/o.json', () =>
      Promise.resolve(new Response(JSON.stringify(file))),
    );
    expect(read.depths.map(({ id }) => id)).toEqual(['surface', '100m', '700m']);
    expect([read.first, read.section.levels.length]).toEqual(['1940-01', 41]);
  });

  it('Given a month, Then its files; the latest for a year after the last; none outside', () => {
    expect(depthFile(maps, '100m', month(1997, 12))).toBe('100m/1997-12.png');
    expect(sectionFile(maps, month(1940, 1))).toBe('section/1940-01.png');
    expect(depthFile(maps, 'surface', month(2026, 11))).toBe('surface/2026-09.png');
    expect(shownMonth(maps, month(1939, 12))).toBeNull();
    expect(sectionFile(maps, month(2028, 1))).toBeNull();
    expect(depthFile(maps, 'surface', month(2028, 1))).toBeNull();
  });

  it('Given a depth and month, Then what the globe shows, the latest said, and how sparse', () => {
    if (surface === undefined || hundred === undefined || deep === undefined) return;
    expect([surface, hundred, deep].map(depthName)).toEqual(['the surface', '100 m', '700 m']);
    expect(oceanText(null, hundred, month(1997, 12))).toBe('Loading the ocean temperature maps…');
    expect(oceanText(maps, hundred, month(1997, 12))).toBe(
      'At 100 m, December 1997, against the month’s 1991–2020 mean: blue colder, red warmer, to ±4 °C (IAP v4.2).',
    );
    expect(oceanText(maps, deep, month(1997, 12))).toContain('Before the Argo floats (2005)');
    expect(oceanText(maps, surface, month(1950, 6))).toContain('Before 1960');
    expect(oceanText(maps, surface, month(2026, 11))).toContain(
      'Showing September 2026, the latest month there is.',
    );
    expect(oceanText(maps, surface, month(1900, 1))).toBe(
      'The maps run from January 1940 to September 2026 (IAP v4.2): none for this month.',
    );
  });
});
