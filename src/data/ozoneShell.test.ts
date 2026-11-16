import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import served from '../../public/data/ozone/shell.json' with { type: 'json' };
import type { Fetch } from '../util/fetchJson';
import {
  finerField,
  HEIGHTS_DRAWN,
  loadOzoneShell,
  shellDate,
  shellDayOf,
  shellField,
  shellRadius,
  shellText,
  type ShellField,
} from './ozoneShell';

const serve =
  (body: unknown): Fetch =>
  () =>
    Promise.resolve(Response.json(body));
const shell = await loadOzoneShell('/data/ozone/shell.json', serve(served));

describe('ozone/shell.json', () => {
  it('has a season for every year from 2003 to 2025, each 184 days from 1 July, with its file, credited to CAMS under CC BY 4.0', () => {
    expect(shell.seasons.map(({ year }) => year)).toEqual(
      Array.from({ length: 23 }, (_, k) => 2003 + k),
    );
    for (const season of shell.seasons) {
      expect(season.first).toBe(`${String(season.year)}-07-01`);
      expect(season.days).toBe(184);
      expect(season.belowMkm2).toHaveLength(184);
      expect(existsSync(`public/data/ozone/${season.file}`)).toBe(true);
    }
    expect(shell.licence).toBe('CC BY 4.0');
    expect(shell.credit).toContain('Copernicus Atmosphere Monitoring Service');
    expect(shell.surfaceMPa).toBe(12);
    expect(shell.grid).toEqual({ rows: 61, columns: 120, stepDeg: 3, north: 90, west: 0 });
  });

  it('shows each hole open through the spring and close by December', () => {
    for (const season of shell.seasons) {
      // 1 July, then the widest day, then 31 December.
      const widest = Math.max(...season.belowMkm2);
      expect(season.belowMkm2[0]).toBeLessThan(widest / 2);
      expect(season.belowMkm2.at(-1)).toBeLessThan(widest / 2);
      expect(widest).toBeGreaterThan(5);
    }
    const widestOf = (year: number) =>
      Math.max(...(shell.seasons.find((each) => each.year === year)?.belowMkm2 ?? []));
    // The deep hole of 2006, the small one of 2019.
    expect(widestOf(2006)).toBeGreaterThan(widestOf(2019) + 5);
  });

  it('is refused with a file that is not a season’s', async () => {
    const [first] = served.seasons;
    const stray = { ...served, seasons: [{ ...first, file: '../elsewhere.png' }] };
    await expect(loadOzoneShell('/x', serve(stray))).rejects.toThrow();
  });
});

describe('the day a date falls on', () => {
  it('Given a date in a season, Then its season and how many days after 1 July; outside, none', () => {
    expect(shellDayOf(shell, { year: 2006, month: 7, day: 1 })?.day).toBe(0);
    const found = shellDayOf(shell, { year: 2006, month: 9, day: 25 });
    expect(found?.season.year).toBe(2006);
    expect(found?.day).toBe(86);
    expect(shellDayOf(shell, { year: 2006, month: 12, day: 31 })?.day).toBe(183);
    expect(shellDayOf(shell, { year: 2006, month: 6, day: 30 })).toBeNull();
    expect(shellDayOf(shell, { year: 2007, month: 1, day: 1 })).toBeNull();
    expect(shellDayOf(shell, { year: 1999, month: 9, day: 25 })).toBeNull();
  });

  it('Given a day, Then its date as written, and what its surface shows', () => {
    const found = shellDayOf(shell, { year: 2006, month: 9, day: 25 });
    if (found === null) throw new Error('no 25 September 2006');
    expect(shellDate(found)).toBe('25 September 2006');
    const area = found.season.belowMkm2[found.day] ?? 0;
    expect(shellText(shell, found)).toBe(
      `The ozone layer on 25 September 2006 at 12:00 UT, as the surface where ozone’s partial pressure is 12 mPa, coloured by total ozone: total ozone under 220 Dobson units over about ${area.toFixed(1)} million km² of the south. Where no height holds that much ozone the surface is open. Its heights are drawn 40 times larger than life.`,
    );
    const july = shellDayOf(shell, { year: 2006, month: 7, day: 1 });
    if (july === null) throw new Error('no 1 July 2006');
    const calm = { ...july, season: { ...july.season, belowMkm2: [0] } };
    expect(shellText(shell, calm)).toContain('nowhere in the south under 220 Dobson units');
  });
});

describe('a day’s surface', () => {
  // Two days of a grid two rows by two columns: bytes of lower, upper, ozone, and a fourth.
  const tiny = { ...shell, grid: { ...shell.grid, rows: 2, columns: 2 } };
  const pixels = new Uint8ClampedArray([
    ...[1, 2, 3, 255, 1, 2, 3, 255, 1, 2, 3, 255, 1, 2, 3, 255],
    ...[100, 170, 100, 255, 0, 0, 25, 255, 90, 0, 60, 255, 110, 180, 150, 255],
  ]);

  it('Given a season’s pixels, Then the day’s heights and ozone, and no surface where a height is nothing', () => {
    const field = shellField(tiny, pixels, 1);
    expect([field.rows, field.columns]).toEqual([2, 2]);
    expect(field.lowerKm[0]).toBeCloseTo(20, 5);
    expect(field.upperKm[0]).toBeCloseTo(27, 5);
    expect(field.du[0]).toBe(300);
    expect(field.lowerKm[1]).toBeNaN();
    expect(field.du[1]).toBe(150);
    // A lower height with no upper is no surface either.
    expect(field.lowerKm[2]).toBeNaN();
    expect(field.upperKm[2]).toBeNaN();
    expect(field.lowerKm[3]).toBeCloseTo(21, 5);
    expect(shellField(tiny, pixels, 0).lowerKm[1]).toBeCloseTo(10.1, 5);
  });

  it('Given a height, Then it is raised off the globe, 40 times larger than life', () => {
    expect(shellRadius(10)).toBe(1.03);
    expect(shellRadius(20)).toBeCloseTo(1.09, 10);
    expect(HEIGHTS_DRAWN).toBe(40);
  });
});

describe('a finer field', () => {
  const field: ShellField = {
    rows: 3,
    columns: 4,
    // The middle row's second column has no surface.
    lowerKm: Float32Array.from([20, 20, 20, 20, 20, Number.NaN, 20, 22, 20, 20, 20, 20]),
    upperKm: Float32Array.from([26, 26, 26, 26, 26, Number.NaN, 26, 28, 26, 26, 26, 26]),
    du: Float32Array.from([300, 300, 300, 300, 300, 100, 300, 320, 300, 300, 300, 300]),
  };
  const finer = finerField(field, 2);
  const at = (row: number, column: number) => row * finer.columns + column;

  it('Given twice the points, Then the field’s own points keep their values, and those between lie between', () => {
    expect([finer.rows, finer.columns]).toEqual([5, 8]);
    expect(finer.lowerKm[at(2, 6)]).toBe(22);
    expect(finer.upperKm[at(2, 6)]).toBe(28);
    expect(finer.lowerKm[at(2, 5)]).toBe(21);
    expect(finer.du[at(2, 5)]).toBe(310);
    // Round the globe: the last point lies between the last column and the first.
    expect(finer.lowerKm[at(2, 7)]).toBe(21);
    expect(finer.lowerKm[at(4, 7)]).toBe(20);
  });

  it('Given a column with no surface, Then none at it, and its neighbours’ heights hold up to halfway there', () => {
    expect(finer.lowerKm[at(2, 2)]).toBeNaN();
    expect(finer.upperKm[at(2, 2)]).toBeNaN();
    // Halfway to it, the neighbour's height, not a mean with nothing.
    expect(finer.lowerKm[at(2, 1)]).toBe(20);
    expect(finer.lowerKm[at(1, 2)]).toBe(20);
    // Its ozone is still weighed in.
    expect(finer.du[at(2, 1)]).toBe(200);
  });
});
