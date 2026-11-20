/**
 * The ocean's currents each month since 1940, near the surface and at 1,500 m (#927), as
 * `ocean-currents/` has them: IAP's geostrophic currents, one image a month and depth on the 1°
 * grid (90°N first, 180°W first): R the eastward current and G the northward, each from −bound to
 * +bound m/s, A 255 where there is one (none within a few degrees of the equator, where
 * geostrophy fails).
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
const month = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/u));

const CurrentsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  paper: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('m/s'),
  encoding: text,
  files: text,
  first: month,
  last: month,
  equator: v.number(),
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  depths: v.pipe(
    v.array(
      v.strictObject({
        id: v.pipe(v.string(), v.regex(/^[a-z0-9]+$/u)),
        metres: v.pipe(v.number(), v.minValue(0)),
        bound: v.pipe(v.number(), v.minValue(0.01)),
      }),
    ),
    v.minLength(1),
  ),
});

export type OceanCurrents = v.InferOutput<typeof CurrentsSchema>;
export type CurrentDepth = OceanCurrents['depths'][number];

export async function loadOceanCurrents(url: string, fetchJson: Fetch): Promise<OceanCurrents> {
  return getJson(fetchJson, url, CurrentsSchema);
}

const numberOf = (stamp: string): number =>
  Number(stamp.slice(0, 4)) * 12 + Number(stamp.slice(5, 7)) - 1;

/**
 * The month shown for `at` (months since January of year 0): itself; after the last there is,
 * the same calendar month of the last year (the currents' pattern holds from year to year more
 * than they change); null before the first.
 */
export function currentsMonth(maps: OceanCurrents, at: number): number | null {
  const first = numberOf(maps.first);
  const last = numberOf(maps.last);
  if (at < first) return null;
  if (at <= last) return at;
  const lastYear = Math.floor(last / 12);
  const inYear = ((at % 12) + 12) % 12;
  const same = lastYear * 12 + inYear;
  const shown = same <= last ? same : same - 12;
  return shown < first ? null : shown;
}

/** A depth's map for a month, `surface/1997-12.png`, or null before the first. */
export function currentsFile(maps: OceanCurrents, depth: string, at: number): string | null {
  const shown = currentsMonth(maps, at);
  if (shown === null) return null;
  const year = Math.floor(shown / 12);
  return `${depth}/${String(year).padStart(4, '0')}-${String(shown - year * 12 + 1).padStart(2, '0')}.png`;
}

/** A depth in words: `near the surface`, `at 1,500 m`. */
export function currentsDepthName(depth: CurrentDepth): string {
  return depth.metres <= 1 ? 'near the surface' : `at ${depth.metres.toLocaleString('en')} m`;
}

/** A field of currents: eastward and northward, m/s, NaN where none; rows 90°N first. */
export interface Field {
  readonly width: number;
  readonly height: number;
  readonly u: Float32Array;
  readonly v: Float32Array;
  readonly bound: number;
}

/** Unpack an image's bytes (RGBA, `width` by `height`) into a field. */
export function fieldOf(
  bytes: Uint8ClampedArray,
  width: number,
  height: number,
  bound: number,
): Field {
  const u = new Float32Array(width * height);
  const north = new Float32Array(width * height);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const scale = (byte: number): number => -bound + (byte / 255) * 2 * bound;
  for (let at = 0; at < width * height; at += 1) {
    const known = view.getUint8(at * 4 + 3) > 0;
    u[at] = known ? scale(view.getUint8(at * 4)) : Number.NaN;
    north[at] = known ? scale(view.getUint8(at * 4 + 1)) : Number.NaN;
  }
  return { width, height, u, v: north, bound };
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

const named = (at: number): string => {
  const year = Math.floor(at / 12);
  return `${MONTHS[at - year * 12] ?? ''} ${String(year)}`;
};

/** What the globe shows, in words: the depth, the month, and the latest year when it stands in. */
export function currentsText(maps: OceanCurrents | null, depth: CurrentDepth, at: number): string {
  if (maps === null) return 'Loading the ocean currents…';
  const shown = currentsMonth(maps, at);
  if (shown === null) {
    return `The currents run from ${named(numberOf(maps.first))} (IAP): none for ${named(at)}.`;
  }
  const latest =
    shown === at
      ? ''
      : ` IAP’s currents end in ${named(numberOf(maps.last))}: showing ${named(shown)}, the same month of the last year there is.`;
  return `The currents ${currentsDepthName(depth)}, ${named(shown)}: each streak drifts with the water, brighter where it is faster (to ${String(depth.bound)} m/s and beyond).${latest}`;
}
