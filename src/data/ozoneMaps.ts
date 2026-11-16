/**
 * The ozone layer over the whole Earth each October (#722), as `ozone/maps.json` names them
 * (the pipeline's `ozone-msr`): the month's mean total ozone every degree, from the MSR-2
 * reanalysis (KNMI, through the Copernicus Climate Data Store), one greyscale PNG a year.
 * October is when the Antarctic ozone hole is deepest. From 1979 the reanalysis has no gaps:
 * where no satellite measured (the polar night), its values are a model's. Before 1979 it rests
 * on one early instrument, and its Octobers have gaps, left as no value.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));

const MapsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  licence: text,
  month: v.literal(10),
  /** Below this many Dobson units is the ozone hole. */
  holeDU: v.number(),
  /** A pixel's value p stands for `offsetDU + p × stepDU`; 0 for no value. */
  encoding: v.strictObject({ offsetDU: v.number(), stepDU: v.pipe(v.number(), v.minValue(0.1)) }),
  columns: v.pipe(v.number(), v.integer()),
  rows: v.pipe(v.number(), v.integer()),
  /** Octobers left out: the reanalysis has values for under a tenth of the Earth. */
  omitted: v.array(v.pipe(v.number(), v.integer())),
  years: v.array(
    v.strictObject({
      year: v.pipe(v.number(), v.integer()),
      file: v.pipe(v.string(), v.regex(/^october-\d{4}\.png$/)),
      version: text,
      /** How far apart the reanalysis's own values are, degrees of latitude and of longitude. */
      gridDeg: v.tuple([v.number(), v.number()]),
      /** The share of the Earth's surface the month has a value for: all of it from 1979. */
      covered: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
      /** The lowest of the month's mean ozone south of 40°S, Dobson units; null with no value there. */
      minimumDU: v.nullable(v.number()),
      /** How much of the south lay under the hole's line in the month's mean, million km²;
       * null unless all the south has values. */
      belowMkm2: v.nullable(v.number()),
    }),
  ),
});

export type OzoneMaps = v.InferOutput<typeof MapsSchema>;
export type OzoneMapYear = OzoneMaps['years'][number];

export async function loadOzoneMaps(url: string, fetchJson: Fetch): Promise<OzoneMaps> {
  return getJson(fetchJson, url, MapsSchema);
}

/** The year's October, if the reanalysis has it. */
export function mapOf(maps: OzoneMaps, year: number): OzoneMapYear | null {
  return maps.years.find((each) => each.year === year) ?? null;
}

/** What an October's map shows, in a line. */
export function mapText(maps: OzoneMaps, found: OzoneMapYear): string {
  const start = `Ozone over the whole Earth, October ${String(found.year)}, the month’s mean`;
  const hole = String(maps.holeDU);
  if (found.belowMkm2 === null) {
    const share = String(Math.round(found.covered * 100));
    const lowest =
      found.minimumDU === null
        ? 'none of it in the far south'
        : `the lowest in the south ${String(Math.round(found.minimumDU))} Dobson units`;
    return `${start}: the one early instrument gave values for ${share}% of the Earth, ${lowest}. The gaps are grey, not filled.`;
  }
  const lowest = found.minimumDU === null ? '' : `, lowest ${String(Math.round(found.minimumDU))}`;
  const under =
    found.belowMkm2 > 0
      ? `under ${hole} Dobson units over ${found.belowMkm2.toFixed(1)} million km² of the south${lowest}`
      : `nowhere in the south under ${hole} Dobson units, the line that marks the hole${lowest}`;
  return `${start}: ${under}.`;
}

/** What is said of a year the reanalysis has no map for, if it left it out; else null. */
export function omittedText(maps: OzoneMaps, year: number): string | null {
  return maps.omitted.includes(year)
    ? `October ${String(year)}: the one early instrument gave values for under a tenth of the Earth, so no map is drawn.`
    : null;
}

/** The ozone a legend names, Dobson units, lowest first: the scale's ends and between. */
export const LEGEND_DU = [220, 265, 310, 355, 400] as const;

type Rgba = readonly [number, number, number, number];

/** How solid the sheet of ozone is drawn over Earth. */
const SHEET = 0.78;

/**
 * The colours along the scale, as the Copernicus Atmosphere Monitoring Service draws total
 * ozone: blue at 220 Dobson units through pale grey at 310 to red at 400. Under 220, the line
 * that marks the hole, the sheet thins to nothing within 20 units: the hole is an opening to the
 * Earth beneath, as it is drawn there.
 */
/** Where the month has no value: grey, so a gap is not taken for the hole. */
const NO_VALUE: Rgba = [120, 120, 128, 0.6];

const STOPS: readonly (readonly [number, Rgba])[] = [
  [200, [58, 76, 192, 0]],
  [220, [58, 76, 192, SHEET]],
  [265, [141, 175, 253, SHEET]],
  [310, [221, 220, 219, SHEET]],
  [355, [244, 154, 123, SHEET]],
  [400, [179, 3, 38, SHEET]],
];

/** The colour for an amount of ozone: red, green, blue (0 to 255) and how solid (0 to 1). */
export function ozoneColour(du: number): Rgba {
  const [lowest, first] = STOPS[0] ?? [0, [0, 0, 0, 0]];
  if (du <= lowest) return first;
  let [from, colour] = [lowest, first];
  for (const [to, next] of STOPS) {
    if (du <= to) {
      const share = to === from ? 1 : (du - from) / (to - from);
      return [
        colour[0] + share * (next[0] - colour[0]),
        colour[1] + share * (next[1] - colour[1]),
        colour[2] + share * (next[2] - colour[2]),
        colour[3] + share * (next[3] - colour[3]),
      ];
    }
    [from, colour] = [to, next];
  }
  return colour;
}

/**
 * Colour each pixel of a map (RGBA bytes of its greyscale image) by its ozone; a pixel with no
 * value is grey.
 */
export function ozoneColours(
  packed: Uint8ClampedArray,
  encoding: OzoneMaps['encoding'],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(packed.length);
  const bytes = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  // Each of the 255 values once, not each pixel.
  const table = Array.from({ length: 256 }, (_, value) =>
    ozoneColour(encoding.offsetDU + value * encoding.stepDU),
  );
  for (let at = 0; at + 3 < packed.length; at += 4) {
    const value = bytes.getUint8(at);
    const colour = value === 0 ? NO_VALUE : table[value];
    if (colour === undefined) continue;
    out.set([colour[0], colour[1], colour[2], Math.round(255 * colour[3])], at);
  }
  return out;
}
