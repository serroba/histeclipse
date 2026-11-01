/**
 * Earth's surface every 5 million years since 540 Ma (`public/data/paleodem/`), from the
 * PALEOMAP PaleoDEMs (Scotese & Wright 2018, CC BY 4.0), packed into greyscale images by the
 * pipeline's `paleodem` command: 0–127 for the sea floor, 128–255 for land.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

const positive = v.pipe(v.number(), v.gtValue(0));

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  /** Depth and height (m) that bytes 0 and 255 stand for. */
  seaDepth: positive,
  landHeight: positive,
  frames: v.pipe(
    v.array(
      v.strictObject({
        ma: v.pipe(v.number(), v.integer(), v.minValue(0)),
        file: v.pipe(v.string(), v.regex(/^\d+\.png$/)),
        /** Share of the surface above sea level. */
        land: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
      }),
    ),
    v.minLength(1),
    v.check(
      (frames) =>
        frames.every((frame, index) => index === 0 || frame.ma > (frames[index - 1]?.ma ?? 0)),
      'frames run from the present back in time',
    ),
  ),
});

export type PaleoDemIndex = v.InferOutput<typeof IndexSchema>;
export type PaleoFrame = PaleoDemIndex['frames'][number];

export async function loadPaleoDemIndex(url: string, fetchJson: Fetch): Promise<PaleoDemIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

/** The oldest moment the elevation maps reach, Ma. */
export function oldestMa(index: PaleoDemIndex): number {
  return elementAt(index.frames, index.frames.length - 1).ma;
}

/**
 * The two maps either side of `ma` and how far between them it lies: 0 shows `younger`, 1
 * `older`. Outside the maps' span the nearest one is shown alone. `frames` run from the
 * present back, as every deep-time index does.
 */
export function framesAround<F extends { readonly ma: number }>(
  frames: readonly F[],
  ma: number,
): { readonly younger: F; readonly older: F; readonly mix: number } {
  const first = elementAt(frames, 0);
  if (ma <= first.ma) return { younger: first, older: first, mix: 0 };
  for (let position = 1; position < frames.length; position += 1) {
    const older = elementAt(frames, position);
    if (ma <= older.ma) {
      const younger = elementAt(frames, position - 1);
      return { younger, older, mix: (ma - younger.ma) / (older.ma - younger.ma) };
    }
  }
  const last = elementAt(frames, frames.length - 1);
  return { younger: last, older: last, mix: 0 };
}
