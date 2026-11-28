/**
 * The ocean's temperature at three depths each month since 1940 (#590), as `ocean-temperature/`
 * has it: IAP v4.2's gridded temperature, each month against its calendar month's 1991–2020 mean,
 * at the surface, 100 m and 700 m, one image each on the 1° grid (R the anomaly from −bound to
 * +bound, A 255 where there is sea); and a section along the equatorial Pacific (#895). Beside
 * them, `deep.json`: the deep ocean at 2,000 to 5,000 m, a map a year (#940).
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';
import { latestFor } from './ensoSst';
import { HEADER_ADDED } from './header';

const text = v.pipe(v.string(), v.minLength(1));
const month = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/u));
const positive = v.pipe(v.number(), v.minValue(0));

const DepthSchema = v.strictObject({
  id: v.pipe(v.string(), v.regex(/^[a-z0-9]+$/u)),
  metres: positive,
  bound: v.pipe(v.number(), v.minValue(0.1)),
  step: positive,
});

const OceanTemperatureSchema = v.strictObject({
  schemaVersion: v.literal(1),
  ...HEADER_ADDED,
  credit: text,
  source: v.pipe(v.string(), v.url()),
  paper: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('°C'),
  baseline: text,
  encoding: text,
  files: text,
  first: month,
  last: month,
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  depths: v.pipe(v.array(DepthSchema), v.minLength(1)),
  section: v.strictObject({
    latitude: positive,
    west: v.number(),
    east: v.number(),
    levels: v.pipe(v.array(positive), v.minLength(2)),
    bound: v.pipe(v.number(), v.minValue(0.1)),
    step: positive,
  }),
});

export type OceanTemperature = v.InferOutput<typeof OceanTemperatureSchema>;

const calendarYear = v.pipe(v.number(), v.integer());

const OceanDeepSchema = v.strictObject({
  schemaVersion: v.literal(1),
  ...HEADER_ADDED,
  credit: text,
  source: v.pipe(v.string(), v.url()),
  paper: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('°C'),
  baseline: text,
  encoding: text,
  files: text,
  first: calendarYear,
  last: calendarYear,
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  depths: v.pipe(v.array(DepthSchema), v.minLength(1)),
});

/** The deep maps (#940): a map a year at each deep level. */
export type OceanDeep = v.InferOutput<typeof OceanDeepSchema>;
export type Depth = OceanTemperature['depths'][number];

export async function loadOceanTemperature(
  url: string,
  fetchJson: Fetch,
): Promise<OceanTemperature> {
  return getJson(fetchJson, url, OceanTemperatureSchema);
}

export async function loadOceanDeep(url: string, fetchJson: Fetch): Promise<OceanDeep> {
  return getJson(fetchJson, url, OceanDeepSchema);
}

/** The year a deep map is shown for `at` (months since January of year 0): its own, or the last. */
export function deepYear(deep: OceanDeep, at: number): number | null {
  const wanted = Math.floor(at / 12);
  if (wanted < deep.first) return null;
  return Math.min(wanted, deep.last);
}

/** A deep level's map for the year of `at`, `deep/3000m/1997.png`, or null where none. */
export function deepFile(deep: OceanDeep, depth: string, at: number): string | null {
  const shown = deepYear(deep, at);
  return shown === null ? null : `deep/${depth}/${String(shown)}.png`;
}

/** What the globe shows at a deep level: the year, the scale, and how little was measured. */
export function deepText(deep: OceanDeep, depth: Depth, at: number): string {
  const shown = deepYear(deep, at);
  if (shown === null) {
    return `The deep maps run from ${String(deep.first)} to ${String(deep.last)} (IAP v4.2): none for this year.`;
  }
  const latest =
    shown === Math.floor(at / 12) ? '' : ` Showing ${String(shown)}, the latest whole year.`;
  return `At ${depthName(depth)}, the year ${String(shown)}, against the ${deep.baseline.slice(0, 9)} mean: blue colder, red warmer, to ±${String(depth.bound)} °C (IAP v4.2).${latest} Floats do not reach this deep: research ships measure it along a few lines about once a decade, and IAP fills the rest from climate models, so this is a reconstruction more than a measurement.`;
}

/** A month's number (months since January of year 0) for `YYYY-MM`. */
function numberOf(stamp: string): number {
  return Number(stamp.slice(0, 4)) * 12 + Number(stamp.slice(5, 7)) - 1;
}

/** `YYYY-MM` for a month's number. */
function stampOf(at: number): string {
  const year = Math.floor(at / 12);
  return `${String(year).padStart(4, '0')}-${String(at - year * 12 + 1).padStart(2, '0')}`;
}

/** The month shown for `at`: itself, or the latest there is in the year after it. */
export function shownMonth(maps: OceanTemperature, at: number): number | null {
  const shown = latestFor(numberOf(maps.last), at);
  return shown < numberOf(maps.first) || shown > numberOf(maps.last) ? null : shown;
}

/** A depth's map for a month, `100m/1997-12.png`, or null where there is none. */
export function depthFile(maps: OceanTemperature, depth: string, at: number): string | null {
  const shown = shownMonth(maps, at);
  return shown === null ? null : `${depth}/${stampOf(shown)}.png`;
}

/** The equatorial section's image for a month, `section/1997-12.png`, or null. */
export function sectionFile(maps: OceanTemperature, at: number): string | null {
  const shown = shownMonth(maps, at);
  return shown === null ? null : `section/${stampOf(shown)}.png`;
}

/** A depth in words: `the surface`, `100 m`. */
export function depthName(depth: Depth): string {
  return depth.metres <= 1 ? 'the surface' : `${depth.metres.toLocaleString('en')} m`;
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
] as const;

function named(at: number): string {
  const year = Math.floor(at / 12);
  return `${MONTHS[at - year * 12] ?? ''} ${String(year)}`;
}

/**
 * What the globe shows, under the picker: the depth and month, the scale, the latest month if
 * the one asked for has none yet, and how well the depth was measured then.
 */
export function oceanText(maps: OceanTemperature | null, depth: Depth, at: number): string {
  if (maps === null) return 'Loading the ocean temperature maps…';
  const shown = shownMonth(maps, at);
  if (shown === null) {
    return `The maps run from ${named(numberOf(maps.first))} to ${named(numberOf(maps.last))} (IAP v4.2): none for this month.`;
  }
  const latest = shown === at ? '' : ` Showing ${named(shown)}, the latest month there is.`;
  const year = Math.floor(shown / 12);
  const sparse =
    depth.metres >= 700 && year < 2005
      ? ' Before the Argo floats (2005), the ocean this deep was seldom measured: IAP fills the gaps from climate models.'
      : year < 1960
        ? ' Before 1960 the ocean was sparsely measured: IAP fills the gaps from climate models.'
        : '';
  return `At ${depthName(depth)}, ${named(shown)}, against the month’s ${maps.baseline.slice(0, 9)} mean: blue colder, red warmer, to ±${String(depth.bound)} °C (IAP v4.2).${latest}${sparse}`;
}
