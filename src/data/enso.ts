/**
 * El Niño and La Niña (#886), as `enso/index.json` has them: NOAA's two indices of the tropical
 * Pacific, the Relative Oceanic Niño Index (official since February 2026) and the Oceanic Niño
 * Index before it, each a value a month (a three-month season at its middle month) and the
 * episodes it names. They disagree in the recent warm years; the site shows both and says where,
 * rather than pick one.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
/** A month as `YYYY-MM`. */
const month = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/u));
const count = v.pipe(v.number(), v.integer(), v.minValue(1));

const EpisodeSchema = v.strictObject({
  phase: v.picklist(['elNino', 'laNina']),
  first: month,
  last: month,
  peak: v.number(),
  peakAt: month,
  ongoing: v.optional(v.literal(true)),
});

const IndexSchema = v.strictObject({
  id: text,
  label: text,
  official: text,
  method: text,
  baseline: text,
  url: v.pipe(v.string(), v.url()),
  first: month,
  values: v.array(v.number()),
  episodes: v.array(EpisodeSchema),
});

const EnsoSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('°C'),
  placed: text,
  threshold: v.number(),
  seasons: count,
  provisionalMonths: v.pipe(v.number(), v.integer(), v.minValue(0)),
  indices: v.pipe(v.array(IndexSchema), v.minLength(1)),
});

export type Enso = v.InferOutput<typeof EnsoSchema>;
export type EnsoIndex = Enso['indices'][number];
export type Episode = EnsoIndex['episodes'][number];
export type Phase = Episode['phase'] | 'neutral';

export async function loadEnso(url: string, fetchJson: Fetch): Promise<Enso> {
  return getJson(fetchJson, url, EnsoSchema);
}

/** Months since January of year 0, for `YYYY-MM`. */
export function monthNumber(text: string): number {
  return Number(text.slice(0, 4)) * 12 + Number(text.slice(5, 7)) - 1;
}

/** A month's number from its year and month (1–12). */
export function monthOf(year: number, monthInYear: number): number {
  return year * 12 + monthInYear - 1;
}

const MONTH_NAMES = [
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
] as const;

/** A month's number in words: `September 2026`. */
export function monthName(at: number): string {
  const year = Math.floor(at / 12);
  return `${MONTH_NAMES[at - year * 12] ?? ''} ${String(year)}`;
}

/** The index's first and last months. */
export function spanOf(index: EnsoIndex): { readonly first: number; readonly last: number } {
  const first = monthNumber(index.first);
  return { first, last: first + index.values.length - 1 };
}

/** The index's value for a month, °C, or null outside it. */
export function valueAt(index: EnsoIndex, at: number): number | null {
  return index.values[at - monthNumber(index.first)] ?? null;
}

/** The episode a month lies in, if any. */
export function episodeAt(index: EnsoIndex, at: number): Episode | null {
  return (
    index.episodes.find(
      (episode) => monthNumber(episode.first) <= at && at <= monthNumber(episode.last),
    ) ?? null
  );
}

/** What one index says of a month: its value and phase; null outside its months. */
export interface Reading {
  readonly index: EnsoIndex;
  readonly value: number;
  readonly phase: Phase;
}

export function readingsAt(enso: Enso, at: number): Reading[] {
  return enso.indices.flatMap((index) => {
    const value = valueAt(index, at);
    if (value === null) return [];
    return [{ index, value, phase: episodeAt(index, at)?.phase ?? 'neutral' }];
  });
}

/** The months the files share, first to last. */
export function shared(enso: Enso): { readonly first: number; readonly last: number } {
  const spans = enso.indices.map(spanOf);
  return {
    first: Math.max(...spans.map(({ first }) => first)),
    last: Math.min(...spans.map(({ last }) => last)),
  };
}

/** Whether CPC may still revise a month: one of the last few the files hold. */
export function provisional(enso: Enso, at: number): boolean {
  const { last } = shared(enso);
  return at <= last && at > last - enso.provisionalMonths;
}

const PHASE_NAMES: Readonly<Record<Phase, string>> = {
  elNino: 'El Niño',
  laNina: 'La Niña',
  neutral: 'neither',
};

/** An index's short name: RONI, ONI. */
export function shortName(index: EnsoIndex): string {
  return index.id.toUpperCase();
}

const signed = (value: number): string => `${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(2)}`;

/** The month in words: each index's phase and value, and whether they agree. */
export function ensoText(enso: Enso, at: number): string {
  const readings = readingsAt(enso, at);
  const { first, last } = shared(enso);
  if (readings.length === 0) {
    return `NOAA’s indices run from ${monthName(first)} to ${monthName(last)}: none for ${monthName(at)}.`;
  }
  const phases = new Set(readings.map(({ phase }) => phase));
  const values = readings.map(({ index, value }) => `${shortName(index)} ${signed(value)} °C`);
  const later = provisional(enso, at) ? ' Provisional: NOAA may still revise it.' : '';
  const [only] = phases;
  if (phases.size === 1 && only !== undefined) {
    const said =
      only === 'neutral'
        ? 'neither El Niño nor La Niña'
        : `${PHASE_NAMES[only]} by ${readings.length === 1 ? 'its index' : 'both indices'}`;
    return `${monthName(at)}: ${said} (${values.join(', ')}).${later}`;
  }
  const each = readings
    .map(
      ({ index, value, phase }) =>
        `${shortName(index)}: ${PHASE_NAMES[phase]} (${signed(value)} °C)`,
    )
    .join('; ');
  return `${monthName(at)}: the indices disagree. ${each}.${later}`;
}

/** Words in a list: `a`, `a and b`, `a, b and c`. */
function listed(words: readonly string[]): string {
  return words.length < 2
    ? words.join('')
    : `${words.slice(0, -1).join(', ')} and ${words.at(-1) ?? ''}`;
}

/** An episode's years: `2015–16`, `1998–2001`, or one year. */
function yearsOf(episode: Episode): string {
  const from = Number(episode.first.slice(0, 4));
  const to = Number(episode.last.slice(0, 4));
  if (from === to) return String(from);
  const sameCentury = Math.floor(from / 100) === Math.floor(to / 100);
  return `${String(from)}–${sameCentury ? String(to).slice(2) : String(to)}`;
}

/** The episodes one index names in a year, as words and peaks. */
function namedIn(
  index: EnsoIndex,
  year: number,
): { readonly words: string; readonly peak: number }[] {
  const start = monthOf(year, 1);
  const end = monthOf(year, 12);
  return index.episodes
    .filter((episode) => monthNumber(episode.first) <= end && monthNumber(episode.last) >= start)
    .map((episode) => ({
      words: `the ${PHASE_NAMES[episode.phase]} of ${yearsOf(episode)}${episode.ongoing === true ? ', still on' : ''}`,
      peak: episode.peak,
    }));
}

/**
 * For a year of the temperature records (#890): the El Niño and La Niña episodes each index
 * names in it, with their peaks; said once where the indices name the same, index by index
 * where they do not. Null before the indices start.
 */
export function ensoYearText(enso: Enso, year: number): string | null {
  const covering = enso.indices.filter((index) => {
    const { first, last } = spanOf(index);
    return first <= monthOf(year, 12) && last >= monthOf(year, 1);
  });
  const [only] = covering;
  if (only === undefined) return null;
  const said = covering.map((index) => ({ index, items: namedIn(index, year) }));
  const agreed = new Set(said.map(({ items }) => items.map(({ words }) => words).join('|')));
  const one = covering.length === 1;
  if (agreed.size === 1) {
    if (namedIn(only, year).length === 0) {
      return `In ${String(year)}, neither El Niño nor La Niña by ${one ? shortName(only) : 'either index'}.`;
    }
    const items = namedIn(only, year);
    const each = items.map(({ words }, at) => {
      const peaks = said.map(
        ({ index, items: own }) =>
          `${one ? '' : `${shortName(index)} `}${signed(own[at]?.peak ?? 0)} °C`,
      );
      return `${words} (peak ${peaks.join(', ')})`;
    });
    return `In ${String(year)}, by ${one ? shortName(only) : 'both indices'}: ${listed(each)}.`;
  }
  const each = said.map(({ index, items }) => {
    const words =
      items.length === 0
        ? 'neither'
        : listed(items.map(({ words: w, peak }) => `${w} (peak ${signed(peak)} °C)`));
    return `${shortName(index)}, ${words}`;
  });
  return `In ${String(year)}: ${each.join('; ')}.`;
}
