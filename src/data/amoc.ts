/**
 * The Atlantic overturning (AMOC), as `amoc/index.json` has it (#531, #925): measured at 26.5°N
 * since 2004 (RAPID), and reconstructions that disagree on whether it has already weakened, each
 * in its own units and kept apart: a temperature index is not a transport, and a reconstruction's
 * anomaly is not the array's measured flow.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
const numbers = v.array(v.number());

const SeriesSchema = v.strictObject({
  id: text,
  label: text,
  measures: text,
  units: text,
  baseline: v.nullable(text),
  source: text,
  url: v.pipe(v.string(), v.url()),
  licence: text,
  note: text,
  /** Decimal years: a month at its middle (2004.292), a year at its start, a decade at its middle. */
  years: numbers,
  values: numbers,
  low: v.optional(numbers),
  high: v.optional(numbers),
  /** A standard deviation, where the source gives one rather than a range. */
  std: v.optional(numbers),
});

const AmocSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  accessed: text,
  disputed: text,
  series: v.pipe(v.array(SeriesSchema), v.minLength(1)),
});

export type Amoc = v.InferOutput<typeof AmocSchema>;
export type AmocSeries = Amoc['series'][number];

export async function loadAmoc(url: string, fetchJson: Fetch): Promise<Amoc> {
  return getJson(fetchJson, url, AmocSchema);
}

/** A series' first and last years. */
export function seriesSpan(series: AmocSeries): { readonly first: number; readonly last: number } {
  return { first: series.years[0] ?? 0, last: series.years.at(-1) ?? 0 };
}

/**
 * A series' value for a year: the mean of its readings that fall in it (RAPID's months, or a
 * yearly series' one reading); null where none does.
 */
export function valueIn(series: AmocSeries, year: number): number | null {
  const within = series.values.filter(
    (_, at) => Math.floor(series.years[at] ?? Number.NaN) === year,
  );
  if (within.length > 0) return within.reduce((sum, each) => sum + each, 0) / within.length;
  return null;
}

/** The range around each reading: the source's low and high, or ± its standard deviation. */
export function rangeOf(
  series: AmocSeries,
): { readonly low: number[]; readonly high: number[] } | null {
  if (series.low !== undefined && series.high !== undefined) {
    return { low: series.low, high: series.high };
  }
  if (series.std !== undefined) {
    const spread = series.std;
    return {
      low: series.values.map((value, at) => value - (spread[at] ?? 0)),
      high: series.values.map((value, at) => value + (spread[at] ?? 0)),
    };
  }
  return null;
}

const signed = (value: number, digits: number): string =>
  `${value < 0 ? '−' : value > 0 ? '+' : ''}${Math.abs(value).toFixed(digits)}`;

/** A value in its series' units: `17.3 Sv`, `−8.42 K`, `+0.47 Sv` for an anomaly. */
export function valueText(series: AmocSeries, value: number): string {
  if (series.id === 'rapid') return `${value.toFixed(1)} Sv`;
  const units = series.units === 'index' ? '' : ` ${series.units}`;
  return `${signed(value, 2)}${units}`;
}

/** What each source reads for a year, in words; the measured array first. */
export function amocText(amoc: Amoc, year: number): string {
  const read = amoc.series.flatMap((series) => {
    const value = valueIn(series, year);
    return value === null ? [] : [`${series.label} ${valueText(series, value)}`];
  });
  if (read.length === 0) return `No source reaches ${String(year)}.`;
  return `${String(year)}: ${read.join('; ')}.`;
}
