import { describe, expect, it } from 'vitest';

import {
  currentsDepthName,
  currentsFile,
  currentsMonth,
  currentsText,
  fieldOf,
  loadOceanCurrents,
  type OceanCurrents,
} from './oceanCurrents';

const CURRENTS: OceanCurrents = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  paper: 'https://example.org/p',
  licence: 'l',
  accessed: '2026-11-20',
  units: 'm/s',
  encoding: 'e',
  files: 'f',
  first: '1940-01',
  last: '2021-12',
  equator: 3,
  columns: 361,
  rows: 181,
  depths: [
    { id: 'surface', metres: 1, bound: 1 },
    { id: '1500m', metres: 1500, bound: 0.2 },
  ],
};
const month = (year: number, number: number): number => year * 12 + number - 1;
const [surface, deep] = CURRENTS.depths;

describe('the ocean’s currents (#927)', () => {
  it('Given the index, Then it reads', async () => {
    const read = await loadOceanCurrents('/c.json', () =>
      Promise.resolve(new Response(JSON.stringify(CURRENTS))),
    );
    expect(read.depths.map(({ id }) => id)).toEqual(['surface', '1500m']);
  });

  it('Given a month, Then its file; after the last, the same month of the last year; none before', () => {
    expect(currentsFile(CURRENTS, 'surface', month(1997, 12))).toBe('surface/1997-12.png');
    expect(currentsMonth(CURRENTS, month(2026, 11))).toBe(month(2021, 11));
    expect(currentsFile(CURRENTS, '1500m', month(2026, 1))).toBe('1500m/2021-01.png');
    expect(currentsFile(CURRENTS, 'surface', month(1939, 12))).toBeNull();
    const short = { ...CURRENTS, last: '2021-06' };
    expect(currentsMonth(short, month(2025, 9))).toBe(month(2020, 9));
    // A single month: no same month of the last year before it to stand in.
    const one = { ...CURRENTS, first: '2010-01', last: '2010-01' };
    expect(currentsMonth(one, month(2010, 2))).toBeNull();
  });

  it('Given bytes, Then the field: −bound to +bound, none where transparent', () => {
    const field = fieldOf(new Uint8ClampedArray([255, 0, 128, 255, 9, 9, 9, 0]), 2, 1, 0.5);
    expect(field.u[0]).toBeCloseTo(0.5);
    expect(field.v[0]).toBeCloseTo(-0.5);
    expect(Number.isNaN(field.u[1] ?? 0)).toBe(true);
  });

  it('Given a depth and month, Then what the globe shows, said plainly', () => {
    if (surface === undefined || deep === undefined) return;
    expect([surface, deep].map(currentsDepthName)).toEqual(['near the surface', 'at 1,500 m']);
    expect(currentsText(null, surface, 0)).toBe('Loading the ocean currents…');
    expect(currentsText(CURRENTS, surface, month(1997, 12))).toMatch(
      /^The currents near the surface, December 1997: each streak drifts/,
    );
    expect(currentsText(CURRENTS, deep, month(2026, 11))).toContain(
      'IAP’s currents end in December 2021: showing November 2021',
    );
    expect(currentsText(CURRENTS, surface, month(1900, 1))).toBe(
      'The currents run from January 1940 (IAP): none for January 1900.',
    );
  });
});
