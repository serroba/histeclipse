/**
 * Measured warming on land and sea since 1850 (`public/data/warming/`, #485, #587): Berkeley
 * Earth's gridded land and ocean temperatures, as 5-year means every five years against
 * 1850–1900, written by the
 * pipeline's `measured-warming` command. Packed as Krapp et al.'s ice-age maps are, so the
 * globe's Temperature shader shows them as the change: R the frame, G the baseline (0 °C).
 */

import * as v from 'valibot';

import { getJson, type Fetch } from '../util/fetchJson';

const WarmingSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.string(),
  source: v.string(),
  licence: v.string(),
  baseline: v.string(),
  /**
   * Where a cell had too few records in the baseline (#497): measured from a later period and
   * shifted back by its band of latitude's difference, or its surface's where its band has none.
   * Land and sea are shifted apart, each by its own cells.
   */
  estimated: v.strictObject({
    from: v.string(),
    /** The share of the cells with a baseline, by area, whose baseline is estimated so. */
    share: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
    surfaces: v.array(
      v.strictObject({
        surface: v.picklist(['land', 'sea']),
        share: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        bands: v.array(v.strictObject({ south: v.number(), shift: v.number() })),
        shift: v.number(),
      }),
    ),
  }),
  /** How many years each frame averages, ending at its year. */
  years: v.pipe(v.number(), v.integer(), v.minValue(1)),
  coverage: v.literal('land and sea'),
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  coldest: v.number(),
  warmest: v.number(),
  frames: v.pipe(
    v.array(
      v.strictObject({
        year: v.pipe(v.number(), v.integer()),
        file: v.string(),
        /** The mean over land and sea with data, °C against the baseline. */
        mean: v.number(),
      }),
    ),
    v.minLength(1),
  ),
});

export type MeasuredWarming = v.InferOutput<typeof WarmingSchema>;
export type WarmingFrame = MeasuredWarming['frames'][number];

export async function loadMeasuredWarming(url: string, fetchJson: Fetch): Promise<MeasuredWarming> {
  return getJson(fetchJson, url, WarmingSchema);
}

/**
 * The frames either side of `year`, and how far towards the earlier one: 0 shows the later
 * (younger) frame, 1 the earlier, as the globe blends its maps. Before the first frame, the
 * first; after the last, the last.
 */
export function warmingAt(
  index: MeasuredWarming,
  year: number,
): { younger: WarmingFrame; older: WarmingFrame; mix: number } {
  let older: WarmingFrame | undefined;
  for (const frame of [...index.frames].sort((a, b) => a.year - b.year)) {
    if (frame.year >= year) {
      if (older === undefined || frame.year === year) {
        return { younger: frame, older: frame, mix: 0 };
      }
      return { younger: frame, older, mix: (frame.year - year) / (frame.year - older.year) };
    }
    older = frame;
  }
  if (older === undefined) throw new Error('No measured-warming frames');
  return { younger: older, older, mix: 0 };
}
