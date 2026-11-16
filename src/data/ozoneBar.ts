/**
 * Ozone's own time bar (#805): the years it has data for and no others, 1970 to 2025, played at
 * two paces. Through the years with only an October's map, a year at a step; through a season
 * of days (1 July to 31 December, from 2003), a day at a step. Moments are UT Julian Days at
 * noon, when each day's surface is: whole numbers.
 */

import type { OzoneHistory } from './ozone';
import { MONTREAL_YEAR } from './ozone';
import type { OzoneMaps } from './ozoneMaps';
import type { OzoneShell } from './ozoneShell';

/** The Julian Day of noon UT on a date. */
export function noonJd(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day, 12) / 86_400_000 + 2_440_587.5;
}

/** A season of days on the bar: its first noon, and how many days. */
interface BarSeason {
  readonly year: number;
  readonly first: number;
  readonly days: number;
  /** Each day's area of the south under the hole's line, million km². */
  readonly belowMkm2: readonly number[];
}

/** What the bar runs over. */
export interface OzoneYears {
  /** The years with an October's map, in order. */
  readonly maps: readonly number[];
  /** The years the reanalysis left out, inside its span. */
  readonly omitted: readonly number[];
  readonly seasons: readonly BarSeason[];
  /** Where play stops in turn outside a season: each season's first day, and 1 October of
   * each year that has only a map. */
  readonly stops: readonly number[];
}

export function ozoneYears(maps: OzoneMaps, shell: OzoneShell): OzoneYears {
  const seasons = shell.seasons.map(({ year, first, days, belowMkm2 }) => {
    const [y = year, month = 7, day = 1] = first.split('-').map(Number);
    return { year, first: noonJd(y, month, day), days, belowMkm2 };
  });
  const withSeason = new Set(seasons.map(({ year }) => year));
  const years = maps.years.map(({ year }) => year);
  const stops = [
    ...years.filter((year) => !withSeason.has(year)).map((year) => noonJd(year, 10, 1)),
    ...seasons.map(({ first }) => first),
  ].sort((a, b) => a - b);
  return { maps: years, omitted: maps.omitted, seasons, stops };
}

/** The first and last moments the bar reaches; null with nothing to run over. */
export function barSpan(
  years: OzoneYears,
): { readonly first: number; readonly last: number } | null {
  const first = years.stops[0];
  const lastStop = years.stops.at(-1);
  if (first === undefined || lastStop === undefined) return null;
  const ends = years.seasons.map((season) => season.first + season.days - 1);
  return { first, last: Math.max(lastStop, ...ends) };
}

/** The season a moment falls in, if any. */
export function seasonAt(years: OzoneYears, jd: number): BarSeason | null {
  const noon = Math.round(jd);
  return (
    years.seasons.find((season) => noon >= season.first && noon < season.first + season.days) ??
    null
  );
}

/**
 * The moment play shows after `jd`: the next day inside a season; else the next stop, a year
 * on or a season's first day; null at the end.
 */
export function nextStop(years: OzoneYears, jd: number): number | null {
  const noon = Math.round(jd);
  const season = seasonAt(years, noon);
  if (season !== null && noon < season.first + season.days - 1) return noon + 1;
  return years.stops.find((stop) => stop > noon) ?? null;
}

/** A moment named on the bar. */
export interface BarMoment {
  readonly name: string;
  readonly meaning: string;
  readonly jd: number;
  readonly date: string;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A noon's date as written: "16 September 1987". */
export function writtenDay(jd: number): string {
  const at = new Date((Math.round(jd) - 2_440_587.5) * 86_400_000);
  return `${String(at.getUTCDate())} ${String(MONTHS[at.getUTCMonth()])} ${String(at.getUTCFullYear())}`;
}

/** The year NASA's record has the widest hole in, and its mean area; null with no years. */
function widest(history: OzoneHistory): { readonly year: number; readonly area: number } | null {
  let found: { year: number; area: number } | null = null;
  for (const [year, area] of history.hole.rows) {
    if (area !== null && (found === null || area > found.area)) found = { year, area };
  }
  return found;
}

/** The widest hole's moment: its season's widest day if it has a season, else its October. */
function widestMoment(years: OzoneYears, history: OzoneHistory): BarMoment[] {
  const found = widest(history);
  if (found === null) return [];
  const season = years.seasons.find(({ year }) => year === found.year);
  const day = season === undefined ? 0 : season.belowMkm2.indexOf(Math.max(...season.belowMkm2));
  const jd = season === undefined ? noonJd(found.year, 10, 1) : season.first + day;
  return [
    {
      name: 'The widest hole',
      meaning: `${String(found.year)} has the widest hole in NASA’s record: ${found.area.toFixed(1)} million km² on average through its spring.`,
      jd,
      date: writtenDay(jd),
    },
  ];
}

/**
 * The moments named on the bar, in order: where the maps begin, the years left out, NASA's
 * record of the hole beginning, the Montreal Protocol, the first season in 3D, and the widest
 * hole in NASA's record. One outside the bar's span is left off.
 */
export function barMoments(years: OzoneYears, history: OzoneHistory): readonly BarMoment[] {
  const span = barSpan(years);
  if (span === null) return [];
  const at = (name: string, meaning: string, jd: number): BarMoment => ({
    name,
    meaning,
    jd,
    date: writtenDay(jd),
  });
  const [firstOmitted] = years.omitted;
  const firstRecord = history.hole.rows[0]?.[0];
  const [firstSeason] = years.seasons;
  const moments = [
    at(
      'The maps begin',
      'The first October the reanalysis has ozone over the whole Earth for.',
      span.first,
    ),
    ...(firstOmitted === undefined
      ? []
      : [
          at(
            'No map',
            `No map for ${years.omitted.join(' and ')}: the one early instrument gave values for under a tenth of the Earth.`,
            noonJd(firstOmitted, 10, 1),
          ),
        ]),
    ...(firstRecord === undefined
      ? []
      : [
          at(
            'The hole measured daily',
            `NASA’s record of the hole begins in ${String(firstRecord)}, with satellites measuring ozone over the whole Earth each day.`,
            noonJd(firstRecord, 10, 1),
          ),
        ]),
    at(
      'Montreal Protocol',
      'The Montreal Protocol on Substances that Deplete the Ozone Layer was signed on 16 September 1987.',
      noonJd(MONTREAL_YEAR, 9, 16),
    ),
    ...(firstSeason === undefined
      ? []
      : [
          at(
            'The layer in 3D',
            'From here each day from 1 July to 31 December has the ozone layer as a surface round the Earth.',
            firstSeason.first,
          ),
        ]),
    ...widestMoment(years, history),
  ];
  return moments
    .filter(({ jd }) => jd >= span.first && jd <= span.last)
    .sort((a, b) => a.jd - b.jd);
}
