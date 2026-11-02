/**
 * The Chinese calendar: months from new moons, computed from DE441 by the rules in use since
 * 1645 (see `data-pipeline/src/histeclipse_pipeline/lunisolar.py`), for 720 BCE to 2100 CE.
 * Earlier courts used other rules, so before 1645 a month can differ by a day, or be numbered
 * differently around a leap month.
 *
 * Years are counted from the Yellow Emperor by the convention adopted in 1912 (year 1 = 2697
 * BCE, so 2024 is 4721); others count from 2698 BCE. Each year and each day is also named in
 * the sixty-fold cycle of stems and branches. The day cycle has run unbroken since at least 720
 * BCE, so a day's name is exact even where the months are not computed.
 *
 * Day numbers here are "fixed days" (R.D.), as in `calendars.ts`.
 */

import * as v from 'valibot';

import table from '../../public/data/calendars/chinese.json' with { type: 'json' };

/** Year 1 of the Yellow Emperor's era: 2697 BCE, astronomical year −2696. */
export const HUANGDI_OFFSET = 2697;
/** Julian Day Number of fixed day 0. */
const RD_TO_JDN = 1_721_425;

const ChineseTableSchema = v.object({
  schemaVersion: v.literal(1),
  credit: v.string(),
  firstYear: v.pipe(v.number(), v.integer()),
  years: v.pipe(
    v.array(
      v.tuple([
        v.pipe(v.number(), v.integer()),
        v.pipe(v.number(), v.integer(), v.minValue(0)),
        v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(13)),
      ]),
    ),
    v.minLength(1),
  ),
});

interface ChineseYear {
  /** Fixed day of the first day of the first month. */
  readonly start: number;
  /** Month lengths as bits, the first month in the lowest: 1 for 30 days, 0 for 29. */
  readonly lengths: number;
  /** The leap month's position in the year (1–13), or 0. */
  readonly leap: number;
}

interface ChineseTable {
  /** Astronomical western year in which the first year in the table begins. */
  readonly firstYear: number;
  readonly years: readonly ChineseYear[];
}

let parsed: ChineseTable | null = null;

function chineseTable(): ChineseTable {
  if (parsed === null) {
    const data = v.parse(ChineseTableSchema, table);
    parsed = {
      firstYear: data.firstYear,
      years: data.years.map(([first, lengths, leap]) => ({
        start: first - RD_TO_JDN,
        lengths,
        leap,
      })),
    };
  }
  return parsed;
}

/** The Yellow Emperor's years the computed months cover. */
export function chineseCoverage(): { readonly first: number; readonly last: number } {
  const { firstYear, years } = chineseTable();
  return {
    first: firstYear + HUANGDI_OFFSET,
    last: firstYear + years.length - 1 + HUANGDI_OFFSET,
  };
}

function yearEntry(year: number): ChineseYear | null {
  const { firstYear, years } = chineseTable();
  return years[year - HUANGDI_OFFSET - firstYear] ?? null;
}

/**
 * The first day of a Chinese year (fixed day), or null outside the computed months. The year
 * after the last in the table ends where its months would: its start is known.
 */
export function chineseNewYear(year: number): number | null {
  const entry = yearEntry(year);
  if (entry !== null) return entry.start;
  const before = yearEntry(year - 1);
  return before === null ? null : before.start + yearLength(before);
}

function monthCount(entry: ChineseYear): number {
  return entry.leap === 0 ? 12 : 13;
}

function monthLength(entry: ChineseYear, position: number): number {
  return (entry.lengths >> position) & 1 ? 30 : 29;
}

function yearLength(entry: ChineseYear): number {
  let days = 0;
  for (let position = 0; position < monthCount(entry); position++) {
    days += monthLength(entry, position);
  }
  return days;
}

/** The Chinese year containing a fixed day, or null outside the computed months. */
export function chineseYearOf(rd: number): number | null {
  const { firstYear, years } = chineseTable();
  const last = years.at(-1);
  if (
    last === undefined ||
    rd < (years[0]?.start ?? Infinity) ||
    rd >= last.start + yearLength(last)
  ) {
    return null;
  }
  let low = 0;
  let high = years.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((years[middle]?.start ?? Infinity) <= rd) low = middle;
    else high = middle - 1;
  }
  return firstYear + low + HUANGDI_OFFSET;
}

const ORDINALS = [
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
  '7th',
  '8th',
  '9th',
  '10th',
  '11th',
  '12th',
];

export interface ChineseDate {
  readonly year: number;
  /** 1–12; a leap month repeats the number of the month before it. */
  readonly month: number;
  readonly leap: boolean;
  readonly day: number;
  /** "3rd month", "leap 4th month". */
  readonly monthName: string;
}

/** The Chinese date of a fixed day, or null outside the computed months. */
export function chineseDate(rd: number): ChineseDate | null {
  const year = chineseYearOf(rd);
  const entry = year === null ? null : yearEntry(year);
  if (year === null || entry === null) return null;
  let left = rd - entry.start;
  let number = 0;
  for (let position = 0; position < monthCount(entry); position++) {
    const leap = position + 1 === entry.leap;
    if (!leap) number++;
    const length = monthLength(entry, position);
    if (left < length) {
      const name = `${ORDINALS[number - 1] ?? ''} month`;
      return { year, month: number, leap, day: left + 1, monthName: leap ? `leap ${name}` : name };
    }
    left -= length;
  }
  throw new RangeError('Day beyond the end of its year'); // unreachable: months fill the year
}

// --- The sixty-fold cycle -------------------------------------------------------------------

const STEMS = [
  ['甲', 'jiǎ'],
  ['乙', 'yǐ'],
  ['丙', 'bǐng'],
  ['丁', 'dīng'],
  ['戊', 'wù'],
  ['己', 'jǐ'],
  ['庚', 'gēng'],
  ['辛', 'xīn'],
  ['壬', 'rén'],
  ['癸', 'guǐ'],
] as const;
const BRANCHES = [
  ['子', 'zǐ', 'Rat'],
  ['丑', 'chǒu', 'Ox'],
  ['寅', 'yín', 'Tiger'],
  ['卯', 'mǎo', 'Rabbit'],
  ['辰', 'chén', 'Dragon'],
  ['巳', 'sì', 'Snake'],
  ['午', 'wǔ', 'Horse'],
  ['未', 'wèi', 'Goat'],
  ['申', 'shēn', 'Monkey'],
  ['酉', 'yǒu', 'Rooster'],
  ['戌', 'xū', 'Dog'],
  ['亥', 'hài', 'Pig'],
] as const;
const ELEMENTS = ['Wood', 'Fire', 'Earth', 'Metal', 'Water'] as const;

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export interface CycleName {
  /** 0 for jiǎzǐ, the first of the sixty. */
  readonly index: number;
  /** "甲辰". */
  readonly characters: string;
  /** "jiǎchén". */
  readonly pinyin: string;
}

function cycleName(index: number): CycleName {
  const stem = STEMS[index % 10] ?? STEMS[0];
  const branch = BRANCHES[index % 12] ?? BRANCHES[0];
  return { index, characters: stem[0] + branch[0], pinyin: stem[1] + branch[1] };
}

/** A day's name in the cycle. 1 January 2000 was 戊午 wùwǔ. */
export function dayCycle(rd: number): CycleName {
  return cycleName(mod(rd + RD_TO_JDN + 49, 60));
}

/** A year's name in the cycle, with its element and animal: 4721 (2024) is 甲辰, Wood Dragon. */
export function yearCycle(year: number): CycleName & { readonly sign: string } {
  const index = mod(year - HUANGDI_OFFSET - 4, 60);
  const element = ELEMENTS[Math.floor((index % 10) / 2)] ?? ELEMENTS[0];
  const animal = BRANCHES[index % 12]?.[2] ?? '';
  return { ...cycleName(index), sign: `${element} ${animal}` };
}
