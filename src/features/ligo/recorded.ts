/**
 * GW170817 as LIGO and Virgo recorded it (#1000): the file the pipeline writes from GWOSC's strain
 * (`data-pipeline/.../gw170817.py`), checked as it is read. For each detector, a time-frequency
 * map, as the discovery paper's Figure 1 draws it: the energy at 48 frequencies from 30 to 500 Hz,
 * 64 times a second from 8 s before the merger to 0.5 s after, each a byte from the noise's level
 * (0) to twelve times it (255). Where Livingston's glitch was zeroed, the file says.
 *
 * Pure: no DOM, no three.js.
 */

import * as v from 'valibot';

import type { DetectorId } from './trips';

const BASE64 = v.pipe(v.string(), v.regex(/^[A-Za-z0-9+/]+={0,2}$/u));
const FINITE = v.pipe(v.number(), v.finite());

/** The file, checked as it is read: every map as large as its frequencies and columns say. */
export const GW170817_SCHEMA = v.pipe(
  v.object({
    event: v.literal('GW170817'),
    utc: v.string(),
    /** The first column, s from the merger, and columns a second. */
    from: FINITE,
    rate: v.pipe(v.number(), v.integer(), v.minValue(1)),
    columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
    /** The rows' frequencies, Hz, rising. */
    frequencies: v.pipe(v.array(v.pipe(FINITE, v.gtValue(0))), v.minLength(2)),
    energy: v.object({ floor: FINITE, top: FINITE }),
    gated: v.object({ detector: v.literal('L1'), from: FINITE, to: FINITE }),
    detectors: v.object({ H1: BASE64, L1: BASE64, V1: BASE64 }),
  }),
  v.check(
    (file) =>
      Object.values(file.detectors).every(
        (text) => atob(text).length === file.frequencies.length * file.columns,
      ),
    'every map should have a tile for each frequency and column',
  ),
);
export type Gw170817Recorded = v.InferOutput<typeof GW170817_SCHEMA>;

/** A detector's map: its tiles, row by row from the lowest frequency, as 0 to 255. */
export function tilesOf(data: Gw170817Recorded, detector: DetectorId): Uint8Array {
  return Uint8Array.from(atob(data.detectors[detector]), (letter) => letter.charCodeAt(0));
}

/** When the merger was, s after the minute of the file's UTC: 4.43 for 12:41:04.43. */
export function mergerSeconds(data: Gw170817Recorded): number {
  const date = new Date(data.utc);
  return date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
}

/** The time, s from the merger, of a column. */
export function columnTime(data: Gw170817Recorded, column: number): number {
  return data.from + column / data.rate;
}

/** How far up a plot `height` tall a frequency lies: the rows are evenly spaced in its log. */
export function yOfFrequency(data: Gw170817Recorded, hertz: number, height: number): number {
  const low = Math.log(Math.min(...data.frequencies));
  const high = Math.log(Math.max(...data.frequencies));
  return height * (1 - (Math.log(hertz) - low) / (high - low));
}

/** A tile's colour, from night blue through violet to gold as its energy rises. */
export function tileColour(value: number): readonly [number, number, number] {
  const share = Math.min(1, Math.max(0, value / 255));
  const night = [4, 8, 22] as const;
  const violet = [60, 40, 120] as const;
  const rose = [200, 90, 110] as const;
  const gold = [255, 205, 90] as const;
  const at = share * 3;
  const below = Math.min(2, Math.floor(at));
  const into = at - below;
  const [a, b] = below === 0 ? [night, violet] : below === 1 ? [violet, rose] : [rose, gold];
  return [
    Math.round(a[0] + (b[0] - a[0]) * into),
    Math.round(a[1] + (b[1] - a[1]) * into),
    Math.round(a[2] + (b[2] - a[2]) * into),
  ];
}
