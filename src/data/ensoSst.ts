/**
 * The sea's surface temperature each month since September 1981 (#886), as `enso-sst/` has it:
 * NOAA OISST v2.1's monthly means, each against the same calendar month's mean over 1991–2020,
 * one image a month on the 1° grid, 90°N first, 180°W first: R the anomaly from −bound to
 * +bound °C (clipped beyond), A 255 where there is sea. What El Niño and La Niña look like: the
 * warm or cool tongue along the equatorial Pacific.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));
const month = v.pipe(v.string(), v.regex(/^\d{4}-(0[1-9]|1[0-2])$/u));

const EnsoSstSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  paper: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('°C'),
  baseline: text,
  bound: v.pipe(v.number(), v.minValue(0.5)),
  encoding: text,
  files: v.literal('YYYY-MM.png'),
  first: month,
  last: month,
  // 361 by 181 for OISST's 1° maps; 181 by 91 for ERSST's 2° maps before them (#894).
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
});

export type EnsoSst = v.InferOutput<typeof EnsoSstSchema>;

export async function loadEnsoSst(url: string, fetchJson: Fetch): Promise<EnsoSst> {
  return getJson(fetchJson, url, EnsoSstSchema);
}

/** A month's number (months since January of year 0) for `YYYY-MM`. */
function numberOf(text: string): number {
  return Number(text.slice(0, 4)) * 12 + Number(text.slice(5, 7)) - 1;
}

/** How many months past its last the latest is still shown. */
const LATEST_REACH = 12;

/** The month's map file, `YYYY-MM.png`, or null where there is none. */
export function mapFile(maps: EnsoSst, at: number): string | null {
  const shown = latestFor(numberOf(maps.last), at);
  if (shown < numberOf(maps.first) || shown > numberOf(maps.last)) return null;
  return fileOf(shown);
}

/**
 * The month to show for `at`: itself, or, in the year after the last there is (today, while the
 * data catch up), the last; so the layer is never empty for the present.
 */
export function latestFor(last: number, at: number): number {
  return at > last && at - last <= LATEST_REACH ? last : at;
}

function fileOf(at: number): string {
  const year = Math.floor(at / 12);
  return `${String(year).padStart(4, '0')}-${String(at - year * 12 + 1).padStart(2, '0')}.png`;
}

/** The anomaly a byte stands for, °C: 0 is −bound, 255 is +bound. */
export function anomalyOf(byte: number, bound: number): number {
  return -bound + (byte / 255) * 2 * bound;
}

type Rgb = readonly [number, number, number];

const PALE: Rgb = [245, 243, 238];
const COOL: Rgb = [35, 85, 205];
const WARM: Rgb = [205, 35, 25];

function mix(from: Rgb, to: Rgb, share: number): Rgb {
  const step = (a: number, b: number): number => Math.round(a + (b - a) * share);
  return [step(from[0], to[0]), step(from[1], to[1]), step(from[2], to[2])];
}

/**
 * Colour each pixel of a packed map (RGBA bytes) by its anomaly: blue colder, red warmer, deeper
 * and more opaque the further from normal, so the Earth shows through where the sea is as usual;
 * nothing over land.
 */
export function sstColours(packed: Uint8ClampedArray, bound: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(packed.length);
  const bytes = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  for (let at = 0; at + 3 < packed.length; at += 4) {
    if (bytes.getUint8(at + 3) === 0) continue;
    const anomaly = anomalyOf(bytes.getUint8(at), bound);
    const strength = Math.min(1, Math.abs(anomaly) / bound);
    const [r, g, b] = mix(PALE, anomaly < 0 ? COOL : WARM, Math.sqrt(strength));
    out.set([r, g, b, Math.round(255 * (0.15 + 0.75 * Math.sqrt(strength)))], at);
  }
  return out;
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

function named(text: string): string {
  return `${MONTHS[Number(text.slice(5, 7)) - 1] ?? ''} ${text.slice(0, 4)}`;
}

/** The maps' record by name, from their credit: `NOAA OISST v2.1`, `NOAA ERSST v6`. */
function recordName(maps: EnsoSst): string {
  const open = maps.credit.indexOf(' (');
  return open < 0 ? maps.credit : maps.credit.slice(0, open);
}

/** What the globe shows of the sea, under the chart: its scale, or why there is no map. */
export function seaText(maps: EnsoSst | null, at: number): string {
  if (maps === null) return 'Loading the sea temperature maps…';
  if (mapFile(maps, at) === null) {
    return `The sea’s monthly maps run from ${named(maps.first)} to ${named(maps.last)} (${recordName(maps)}): none for this month.`;
  }
  const bound = maps.bound.toFixed(0);
  const last = numberOf(maps.last);
  const latest = at > last ? ` Showing ${named(maps.last)}, the latest month there is.` : '';
  const grid = maps.columns > 300 ? '' : `, on its ${String(360 / (maps.columns - 1))}° grid`;
  return `On the globe, the sea’s surface against its ${maps.baseline.slice(0, 9)} mean for the month: blue colder, red warmer, to ±${bound} °C (${recordName(maps)}${grid}).${latest}`;
}

/** For "Why here?" (#893): the sea's surface at a place in the month, or null on land. */
export function seaHereText(maps: EnsoSst, value: number | null, monthText: string): string | null {
  if (value === null) return null;
  return `The sea’s surface here in ${monthText}: ${value < 0 ? '−' : '+'}${Math.abs(value).toFixed(1)} °C against the month’s ${maps.baseline.slice(0, 9)} mean (${recordName(maps)}).`;
}
