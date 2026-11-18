import { describe, expect, it } from 'vitest';

import { anomalyOf, loadEnsoSst, mapFile, seaText, sstColours, type EnsoSst } from './ensoSst';

const MAPS: EnsoSst = {
  schemaVersion: 1,
  credit: 'c',
  source: 'https://example.org/',
  paper: 'https://example.org/paper',
  licence: 'l',
  accessed: '2026-11-19',
  units: '°C',
  baseline: '1991–2020, each calendar month against its own mean',
  bound: 4,
  encoding: 'e',
  files: 'YYYY-MM.png',
  first: '1981-09',
  last: '2026-10',
  columns: 361,
  rows: 181,
};
const month = (year: number, number: number): number => year * 12 + number - 1;

describe('the sea surface temperature maps', () => {
  it('Given the index, Then it reads', async () => {
    const read = await loadEnsoSst('/i.json', () =>
      Promise.resolve(new Response(JSON.stringify(MAPS))),
    );
    expect(read.first).toBe('1981-09');
  });

  it('Given a month, Then its file, and none outside the maps', () => {
    expect(mapFile(MAPS, month(1997, 12))).toBe('1997-12.png');
    expect(mapFile(MAPS, month(1981, 9))).toBe('1981-09.png');
    expect(mapFile(MAPS, month(2026, 10))).toBe('2026-10.png');
    expect(mapFile(MAPS, month(1981, 8))).toBeNull();
    expect(mapFile(MAPS, month(2026, 11))).toBeNull();
  });

  it('Given bytes, Then the anomaly from −bound to +bound', () => {
    expect(anomalyOf(0, 4)).toBe(-4);
    expect(anomalyOf(255, 4)).toBe(4);
  });

  it('Given packed pixels, Then red warmer, blue colder, faint near normal, nothing on land', () => {
    const packed = new Uint8ClampedArray([
      255, 128, 255, 255, 0, 128, 255, 255, 128, 128, 255, 255, 255, 0, 0, 0,
    ]);
    const out = sstColours(packed, 4);
    expect([...out.slice(0, 4)]).toEqual([205, 35, 25, 230]);
    expect([...out.slice(4, 8)]).toEqual([35, 85, 205, 230]);
    const [, , , faint = 0] = out.slice(8, 12);
    expect(faint).toBeLessThan(80);
    expect([...out.slice(12, 16)]).toEqual([0, 0, 0, 0]);
  });

  it('Given the month, Then the legend says the scale, or where the maps run', () => {
    expect(seaText(null, month(2000, 1))).toBe('Loading the sea temperature maps…');
    expect(seaText(MAPS, month(2000, 1))).toBe(
      'On the globe, the sea’s surface against its 1991–2020 mean for the month: blue colder, red warmer, to ±4 °C (NOAA OISST).',
    );
    expect(seaText(MAPS, month(1960, 1))).toBe(
      'The sea’s monthly maps run from September 1981 to October 2026 (NOAA OISST): none for this month.',
    );
  });
});
