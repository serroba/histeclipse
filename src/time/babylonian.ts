/**
 * The Babylonian calendar: months from the first visible crescent at Babylon, computed from
 * DE441 (see `data-pipeline/src/histeclipse_pipeline/lunisolar.py`), for 750 BCE to 100 CE.
 *
 * Years begin with Nisannu in spring. A year has 12 months or 13. From 367 BCE the 19-year cycle
 * counted from Nabonassar's first year (747 BCE) set them: years 3, 6, 8, 11, 14 and 19 add a
 * second Addaru and year 17 a second Ululu (Parker & Dubberstein; Britton 2007). Before, the king
 * or the temple decreed each leap month: for 626–367 BCE they are those attested on tablets or
 * reconstructed by Parker & Dubberstein (`babylonianHistory.ts`); before 626 BCE, the cycle run
 * backwards, which may differ from those decreed.
 *
 * Years are counted from Nabonassar, as Babylonian astronomers did (year 1 begins in spring 747
 * BCE); from 311 BCE the Seleucid Era is given too. Under the Persian kings (550–330 BCE) each
 * month also has its Old Persian name (Encyclopaedia Iranica, "Calendars"; names marked * are
 * reconstructed from Elamite).
 *
 * Day numbers here are "fixed days" (R.D.), as in `calendars.ts`.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { leapMonthOf, type LeapMonth } from './babylonianHistory';
import table from '../../public/data/calendars/babylon.json' with { type: 'json' };

/** Nabonassar's year 1 begins in spring 747 BCE, astronomical year −746. */
export const NABONASSAR_OFFSET = 747;
/** Seleucid Era 1 begins on 1 Nisannu, 3 April 311 BCE: Nabonassar year 437. */
const SELEUCID_FIRST = 437;
/** Fixed day of 3 April 311 BCE (Julian). */
const SELEUCID_EPOCH = -113_502;
/** The Persian kings: Cyrus took Babylon in 539 BCE; Old Persian names from 550 to 330 BCE. */
const PERSIAN_FROM = 198;
const PERSIAN_UNTIL = 417;
const RD_TO_JDN = 1_721_425;

const BabylonTableSchema = v.object({
  schemaVersion: v.literal(1),
  credit: v.string(),
  site: v.tuple([v.number(), v.number()]),
  firstDay: v.pipe(v.number(), v.integer()),
  lengths: v.pipe(v.string(), v.regex(/^[01]+$/)),
  uncertain: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))),
});

const MONTHS = [
  ['Nisannu', 'Ādukanaiša'],
  ['Ayyaru', 'Θūravāhara'],
  ['Simanu', 'Θāigarciš'],
  ['Duzu', 'Garmapada'],
  ['Abu', 'Drnabāji'],
  ['Ululu', 'Kārapaθiya'],
  ['Tashritu', 'Bāgayādiš'],
  ['Arahsamna', '*Vrkazana'],
  ['Kislimu', 'Āçiyādiya'],
  ['Tebetu', 'Anāmaka'],
  ['Shabatu', '*Θwayauvā'],
  ['Addaru', 'Viyaxna'],
] as const;

type MonthName = readonly [babylonian: string, persian: string];

const SECOND_ULULU: MonthName = ['Ululu II', 'Kārapaθiya II'];
const SECOND_ADDARU: MonthName = ['Addaru II', 'Viyaxna II'];

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

/** The months of a year counted from Nabonassar, in order. */
/** The year BCE in which a Nabonassar year began. */
export function bceOf(year: number): number {
  return NABONASSAR_OFFSET + 1 - year;
}

function monthsOf(year: number): readonly MonthName[] {
  const recorded = leapMonthOf(bceOf(year));
  if (recorded !== undefined) return withLeap(recorded);
  const place = mod(year, 19);
  if (place === 17) return [...MONTHS.slice(0, 6), SECOND_ULULU, ...MONTHS.slice(6)];
  if ([0, 3, 6, 8, 11, 14].includes(place)) return [...MONTHS, SECOND_ADDARU];
  return MONTHS;
}

function withLeap(leap: LeapMonth | null): readonly MonthName[] {
  if (leap === null) return MONTHS;
  if (leap.kind === 'Ululu II') return [...MONTHS.slice(0, 6), SECOND_ULULU, ...MONTHS.slice(6)];
  return [...MONTHS, SECOND_ADDARU];
}

function leapMonthName(year: number): string | null {
  const months = monthsOf(year);
  if (months.length === 12) return null;
  return months.includes(SECOND_ULULU) ? SECOND_ULULU[0] : SECOND_ADDARU[0];
}

/** Where a year's leap month comes from: tablets, a reconstruction, or the cycle. */
export type LeapSource = 'attested' | 'reconstructed' | 'cycle' | 'cycle run back';

function leapSourceOf(year: number): LeapSource {
  const recorded = leapMonthOf(bceOf(year));
  if (recorded === undefined) return bceOf(year) > 626 ? 'cycle run back' : 'cycle';
  return recorded?.attested === true ? 'attested' : 'reconstructed';
}

interface BabylonTable {
  /** Fixed day each month begins on, and the day after the last month. */
  readonly starts: readonly number[];
  /** The first month of the first whole year, and the first after the last whole year. */
  readonly first: number;
  readonly end: number;
  /** Which months may begin a day off: the crescent was a close call. */
  readonly uncertain: ReadonlySet<number>;
  /** The Nabonassar year of each month and its place in that year. */
  readonly years: readonly number[];
  readonly places: readonly number[];
}

let parsed: BabylonTable | null = null;

function babylonTable(): BabylonTable {
  if (parsed !== null) return parsed;
  const data = v.parse(BabylonTableSchema, table);
  const starts = [data.firstDay - RD_TO_JDN];
  let day = data.firstDay - RD_TO_JDN;
  for (const length of data.lengths) {
    day += length === '1' ? 30 : 29;
    starts.push(day);
  }
  const anchor = starts.indexOf(SELEUCID_EPOCH);
  if (anchor < 0) throw new Error('The month table has no month beginning on 3 April 311 BCE');
  const count = starts.length - 1;
  const years = new Array<number>(count);
  const places = new Array<number>(count);
  // Forwards from 1 Nisannu of the Seleucid Era's first year, then backwards.
  let year = SELEUCID_FIRST;
  let place = 0;
  for (let month = anchor; month < count; month++) {
    years[month] = year;
    places[month] = place;
    place++;
    if (place === monthsOf(year).length) {
      year++;
      place = 0;
    }
  }
  year = SELEUCID_FIRST;
  place = 0;
  for (let month = anchor - 1; month >= 0; month--) {
    place--;
    if (place < 0) {
      year--;
      place = monthsOf(year).length - 1;
    }
    years[month] = year;
    places[month] = place;
  }
  // Only whole years count: the table begins and ends part-way through one.
  const first = places.indexOf(0);
  const end = places.lastIndexOf(0);
  parsed = { starts, first, end, uncertain: new Set(data.uncertain), years, places };
  return parsed;
}

/** The month containing a fixed day, by its index in the table, or null outside it. */
function monthIndex(rd: number): number | null {
  const { starts, first, end } = babylonTable();
  if (rd < elementAt(starts, first) || rd >= elementAt(starts, end)) return null;
  let low = first;
  let high = end - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (elementAt(starts, middle) <= rd) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The first day of a Nabonassar year (fixed day), or null outside the computed months. */
export function babylonianNewYear(year: number): number | null {
  const { starts, first, end, years } = babylonTable();
  if (year < elementAt(years, first) || year > elementAt(years, end)) return null;
  // The first month of each year from the first whole one; the last is where the table's end.
  const month = years.indexOf(year, first);
  return elementAt(starts, month);
}

/** The Nabonassar year containing a fixed day, or null outside the computed months. */
export function babylonianYearOf(rd: number): number | null {
  const month = monthIndex(rd);
  return month === null ? null : elementAt(babylonTable().years, month);
}

export interface BabylonianDate {
  readonly year: number;
  /** "Addaru", "Ululu II". */
  readonly monthName: string;
  /** The Old Persian name, under the Persian kings (550–330 BCE); otherwise null. */
  readonly persianName: string | null;
  readonly day: number;
  /** The crescent was a close call: the month may have begun a day earlier or later. */
  readonly dayUncertain: boolean;
  /**
   * Where the year's leap month (or its lack) comes from. A year of 626–367 BCE with none is
   * "reconstructed": Parker & Dubberstein leave it at twelve months.
   */
  readonly leapSource: LeapSource;
  /** The year's leap month, if it has one. */
  readonly leapMonth: string | null;
  /** The Seleucid Era year, from 311 BCE; otherwise null. */
  readonly seleucidYear: number | null;
}

/** The Babylonian date of a fixed day, or null outside the computed months. */
export function babylonianDate(rd: number): BabylonianDate | null {
  const month = monthIndex(rd);
  if (month === null) return null;
  const { starts, uncertain, years, places } = babylonTable();
  const year = elementAt(years, month);
  const name = elementAt(monthsOf(year), elementAt(places, month));
  return {
    year,
    monthName: name[0],
    persianName: year >= PERSIAN_FROM && year <= PERSIAN_UNTIL ? name[1] : null,
    day: rd - elementAt(starts, month) + 1,
    dayUncertain: uncertain.has(month),
    leapSource: leapSourceOf(year),
    leapMonth: leapMonthName(year),
    seleucidYear: year >= SELEUCID_FIRST ? year - SELEUCID_FIRST + 1 : null,
  };
}

export interface BabylonianMonth {
  /** "Nisannu", "Addaru II". */
  readonly name: string;
  /** Fixed day of its first day. */
  readonly start: number;
}

/** The months of a Nabonassar year, in order, or null outside the computed months. */
export function babylonianMonths(year: number): readonly BabylonianMonth[] | null {
  const { starts, first, end, years } = babylonTable();
  const from = years.indexOf(year, first);
  if (from < 0 || from >= end) return null;
  return monthsOf(year).map(([name], place) => ({ name, start: elementAt(starts, from + place) }));
}
