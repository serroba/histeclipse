import { describe, expect, it } from 'vitest';

import historyFile from '../../public/data/ozone/history.json' with { type: 'json' };
import mapsFile from '../../public/data/ozone/maps.json' with { type: 'json' };
import shellFile from '../../public/data/ozone/shell.json' with { type: 'json' };
import type { OzoneHistory } from './ozone';
import {
  barMoments,
  barSpan,
  nextStop,
  noonJd,
  ozoneYears,
  seasonAt,
  writtenDay,
} from './ozoneBar';
import type { OzoneMaps } from './ozoneMaps';
import type { OzoneShell } from './ozoneShell';

const maps = mapsFile as unknown as OzoneMaps;
const shell = shellFile as unknown as OzoneShell;
const history = historyFile as unknown as OzoneHistory;
const years = ozoneYears(maps, shell);

describe('ozone’s own years (#805)', () => {
  it('Given a date, Then its noon as a Julian Day, a whole number, and written back', () => {
    expect(noonJd(2000, 1, 1)).toBe(2_451_545);
    expect(writtenDay(noonJd(1987, 9, 16))).toBe('16 September 1987');
    expect(writtenDay(noonJd(2006, 7, 1) + 0.2)).toBe('1 July 2006');
  });

  it('Given the maps and the seasons, Then the bar runs from 1 October 1970 to 31 December 2025, and nowhere else', () => {
    expect(barSpan(years)).toEqual({ first: noonJd(1970, 10, 1), last: noonJd(2025, 12, 31) });
    expect(years.maps[0]).toBe(1970);
    expect(years.omitted).toEqual([1977, 1978]);
    expect(years.seasons).toHaveLength(23);
    // A stop for each year with only a map, and one for each season: none for the years left out.
    expect(years.stops).toHaveLength(54);
    expect(years.stops).not.toContain(noonJd(1977, 10, 1));
    expect(years.stops).toContain(noonJd(2002, 10, 1));
    expect(years.stops).toContain(noonJd(2003, 7, 1));
    expect(years.stops).not.toContain(noonJd(2003, 10, 1));
  });

  it('Given nothing to run over, Then no span and no moments', () => {
    const none = ozoneYears({ ...maps, years: [], omitted: [] }, { ...shell, seasons: [] });
    expect(barSpan(none)).toBeNull();
    expect(barMoments(none, history)).toEqual([]);
    expect(nextStop(none, noonJd(1990, 1, 1))).toBeNull();
  });

  it('Given maps alone, Then the bar ends at the last October', () => {
    const only = ozoneYears(maps, { ...shell, seasons: [] });
    expect(barSpan(only)?.last).toBe(noonJd(2025, 10, 1));
  });

  it('Given a moment, Then its season if it falls in one', () => {
    expect(seasonAt(years, noonJd(2006, 9, 25))?.year).toBe(2006);
    expect(seasonAt(years, noonJd(2006, 7, 1))?.year).toBe(2006);
    expect(seasonAt(years, noonJd(2006, 12, 31))?.year).toBe(2006);
    expect(seasonAt(years, noonJd(2006, 6, 30))).toBeNull();
    expect(seasonAt(years, noonJd(2007, 1, 1))).toBeNull();
    expect(seasonAt(years, noonJd(1990, 10, 1))).toBeNull();
  });
});

describe('what play shows next', () => {
  it('Given a year with only a map, Then the next year’s October, over the years left out', () => {
    expect(nextStop(years, noonJd(1985, 10, 1))).toBe(noonJd(1986, 10, 1));
    expect(nextStop(years, noonJd(1976, 10, 1))).toBe(noonJd(1979, 10, 1));
    // From any other day of the year, its own October if still ahead.
    expect(nextStop(years, noonJd(1985, 3, 1))).toBe(noonJd(1985, 10, 1));
    expect(nextStop(years, noonJd(1985, 11, 1))).toBe(noonJd(1986, 10, 1));
  });

  it('Given the last year with only a map, Then the first season’s first day', () => {
    expect(nextStop(years, noonJd(2002, 10, 1))).toBe(noonJd(2003, 7, 1));
  });

  it('Given a day of a season, Then the next day, to the season’s last; then the next season’s first', () => {
    expect(nextStop(years, noonJd(2006, 9, 25))).toBe(noonJd(2006, 9, 26));
    expect(nextStop(years, noonJd(2006, 12, 30))).toBe(noonJd(2006, 12, 31));
    expect(nextStop(years, noonJd(2006, 12, 31))).toBe(noonJd(2007, 7, 1));
    // Between two seasons, the next one's first day.
    expect(nextStop(years, noonJd(2007, 3, 1))).toBe(noonJd(2007, 7, 1));
  });

  it('Given the last day, or a moment past it, Then nothing', () => {
    expect(nextStop(years, noonJd(2025, 12, 31))).toBeNull();
    expect(nextStop(years, noonJd(2030, 1, 1))).toBeNull();
    // Before the first, the first.
    expect(nextStop(years, noonJd(1960, 1, 1))).toBe(noonJd(1970, 10, 1));
  });
});

describe('the moments named on the bar', () => {
  const moments = barMoments(years, history);

  it('Given the record, Then six moments in order, from the first map to the widest hole', () => {
    expect(moments.map(({ name }) => name)).toEqual([
      'The maps begin',
      'No map',
      'The hole measured daily',
      'Montreal Protocol',
      'The layer in 3D',
      'The widest hole',
    ]);
    expect(moments.map(({ date }) => date).slice(0, 5)).toEqual([
      '1 October 1970',
      '1 October 1977',
      '1 October 1979',
      '16 September 1987',
      '1 July 2003',
    ]);
    expect(moments[1]?.meaning).toContain('No map for 1977 and 1978');
    expect(moments[3]?.meaning).toContain('signed on 16 September 1987');
  });

  it('Given the widest hole in NASA’s record, 2006, Then its moment is its season’s widest day', () => {
    const widest = moments.at(-1);
    expect(widest?.meaning).toContain(
      '2006 has the widest hole in NASA’s record: 26.6 million km²',
    );
    const season = years.seasons.find(({ year }) => year === 2006);
    if (season === undefined) throw new Error('no 2006');
    const day = season.belowMkm2.indexOf(Math.max(...season.belowMkm2));
    expect(widest?.jd).toBe(season.first + day);
    expect(widest?.date).toMatch(/^\d+ (September|October) 2006$/);
  });

  it('Given no seasons, no years left out and no record, Then only what is left, the widest hole in its October', () => {
    const plain = ozoneYears({ ...maps, omitted: [] }, { ...shell, seasons: [] });
    expect(barMoments(plain, history).map(({ name, date }) => [name, date])).toEqual([
      ['The maps begin', '1 October 1970'],
      ['The hole measured daily', '1 October 1979'],
      ['Montreal Protocol', '16 September 1987'],
      ['The widest hole', '1 October 2006'],
    ]);
    const empty = { ...history, hole: { ...history.hole, rows: [] } };
    expect(barMoments(plain, empty).map(({ name }) => name)).toEqual([
      'The maps begin',
      'Montreal Protocol',
    ]);
    // A moment before the bar's first year is left off.
    const late = ozoneYears(
      { ...maps, omitted: [], years: maps.years.filter(({ year }) => year >= 1990) },
      { ...shell, seasons: [] },
    );
    expect(barMoments(late, history).map(({ name }) => name)).toEqual([
      'The maps begin',
      'The widest hole',
    ]);
  });
});
