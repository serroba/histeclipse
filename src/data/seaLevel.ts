/**
 * Global sea level through time (`public/data/sealevel/index.json`): four reconstructions,
 * written by the pipeline's `sealevel` command and kept side by side. Each series gives metres
 * above (+) or below (−) today by age in thousands of years (ka), some with a range.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const metres = v.array(v.pipe(v.number(), v.minValue(-500), v.maxValue(500)));

const SeriesSchema = v.pipe(
  v.strictObject({
    id: v.pipe(v.string(), v.regex(/^[a-z0-9-]+$/)),
    label: v.pipe(v.string(), v.minLength(1)),
    method: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.minLength(1)),
    url: v.pipe(v.string(), v.url()),
    licence: v.pipe(v.string(), v.minLength(1)),
    note: v.optional(v.pipe(v.string(), v.minLength(1))),
    ages: v.pipe(v.array(v.pipe(v.number(), v.minValue(0))), v.minLength(2)),
    level: metres,
    low: v.optional(metres),
    high: v.optional(metres),
  }),
  v.check(
    ({ ages, level, low, high }) =>
      level.length === ages.length &&
      (low === undefined || low.length === ages.length) &&
      (high === undefined || high.length === ages.length),
    'every column has a value for every age',
  ),
  v.check(
    ({ ages }) => ages.every((age, index) => index === 0 || age > (ages[index - 1] ?? 0)),
    'ages run from the present back',
  ),
);

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  series: v.pipe(v.array(SeriesSchema), v.minLength(1)),
});

export type SeaLevelIndex = v.InferOutput<typeof IndexSchema>;
export type SeaLevelSeries = SeaLevelIndex['series'][number];

export async function loadSeaLevel(url: string, fetchJson: Fetch): Promise<SeaLevelIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

/** A value of a series' column at `ka`, between its two nearest ages; null outside its span. */
function interpolate(
  ages: readonly number[],
  values: readonly number[],
  ka: number,
): number | null {
  const first = ages[0];
  const last = ages.at(-1);
  if (first === undefined || last === undefined || ka < first || ka > last) return null;
  // The first age at or past `ka`, by bisection.
  let low = 0;
  let high = ages.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((ages[middle] ?? 0) < ka) low = middle + 1;
    else high = middle;
  }
  const after = ages[low] ?? ka;
  const value = values[low] ?? 0;
  if (after === ka || low === 0) return value;
  const before = ages[low - 1] ?? after;
  const previous = values[low - 1] ?? value;
  return previous + ((value - previous) * (ka - before)) / (after - before);
}

export interface SeaLevelAt {
  readonly level: number;
  /** The source's range there, where it gives one. */
  readonly low: number | null;
  readonly high: number | null;
}

/** Sea level by one reconstruction at `ka`; null where it does not reach. */
export function seaLevelAt(series: SeaLevelSeries, ka: number): SeaLevelAt | null {
  const level = interpolate(series.ages, series.level, ka);
  if (level === null) return null;
  return {
    level,
    low: series.low === undefined ? null : interpolate(series.ages, series.low, ka),
    high: series.high === undefined ? null : interpolate(series.ages, series.high, ka),
  };
}
