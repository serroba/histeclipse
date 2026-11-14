/**
 * Where the ocean has gained heat (#589): IAP v4.2's trend maps (`ocean-heat-map/`), the heat the
 * water column under each square metre gained per second, W/m², since 1960 (0–700 m, 0–2000 m)
 * and in the Argo years (2005–2025, 0–2000 m). Heat content, not temperature: its own diverging
 * colours, never the temperature legend's. Each map is an image on the 1° grid, 90°N first,
 * 180°W first: R the trend from −bound to +bound, B 255 where it is significant at 10%, A 255
 * where there is sea.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const text = v.pipe(v.string(), v.minLength(1));

const OceanHeatSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: text,
  source: v.pipe(v.string(), v.url()),
  paper: v.pipe(v.string(), v.url()),
  licence: text,
  accessed: text,
  units: v.literal('W/m²'),
  unitsNote: text,
  sourceBaseline: text,
  significance: v.number(),
  encoding: text,
  columns: v.literal(361),
  rows: v.literal(181),
  maps: v.pipe(
    v.array(
      v.strictObject({
        id: text,
        file: text,
        period: v.tuple([v.number(), v.number()]),
        bound: v.pipe(v.number(), v.minValue(0.1)),
        mean: v.number(),
        significantShare: v.number(),
        layer: text,
      }),
    ),
    v.minLength(1),
  ),
});

export type OceanHeat = v.InferOutput<typeof OceanHeatSchema>;
export type OceanHeatMap = OceanHeat['maps'][number];

export async function loadOceanHeat(url: string, fetchJson: Fetch): Promise<OceanHeat> {
  return getJson(fetchJson, url, OceanHeatSchema);
}

/** The map's trend from its byte: 0 is −bound, 255 is +bound. */
export function trendOf(byte: number, bound: number): number {
  return -bound + (byte / 255) * 2 * bound;
}

/**
 * Losing heat: blue; gaining: orange to deep red; pale near no change. Its own scale, never the
 * temperature legend's.
 */

type Rgb = readonly [number, number, number];

const PALE: Rgb = [235, 230, 220];
const COOL: Rgb = [40, 80, 200];
const WARM: Rgb = [190, 40, 20];

function mix(from: Rgb, to: Rgb, share: number): Rgb {
  const step = (a: number, b: number): number => Math.round(a + (b - a) * share);
  return [step(from[0], to[0]), step(from[1], to[1]), step(from[2], to[2])];
}

/** How opaque a value is drawn where it is not significant, against where it is. */
export const NOT_SIGNIFICANT = 0.35;

/**
 * Colour each pixel of a packed map (RGBA bytes) by its trend: its hue by sign, its strength by
 * size against the bound, faded where not significant, nothing over land.
 */
export function heatColours(packed: Uint8ClampedArray, bound: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(packed.length);
  const bytes = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  for (let at = 0; at + 3 < packed.length; at += 4) {
    if (bytes.getUint8(at + 3) === 0) continue;
    const trend = trendOf(bytes.getUint8(at), bound);
    const strength = Math.min(1, Math.abs(trend) / bound);
    // Graded from pale at no change to deep at the bound, so 0.5 and 1.5 W/m² read apart.
    const [r, g, b] = mix(PALE, trend < 0 ? COOL : WARM, Math.sqrt(strength));
    const significant = bytes.getUint8(at + 2) > 127;
    out.set(
      [r, g, b, Math.round(255 * (0.35 + 0.5 * strength) * (significant ? 1 : NOT_SIGNIFICANT))],
      at,
    );
  }
  return out;
}

/** What a map shows, in words: its layer, its years, its mean and how much is significant. */
export function mapText(map: OceanHeatMap): string {
  const [first, last] = map.period;
  return `${map.layer}, ${String(first)}–${String(last)}: on average ${map.mean.toFixed(2)} W/m² gained; ${String(Math.round(map.significantShare * 100))}% of the sea significant at 10%.`;
}
