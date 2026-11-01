/**
 * Ice sheets over the last 80,000 years (`public/data/icesheets/`), from PaleoMIST 1.0 (Gowan et
 * al. 2021, CC BY 4.0), packed by the pipeline's `icesheets` command: ice thickness, a byte per
 * `metresPerStep` metres, 0 where there is no ice, every 2,500 years.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  metresPerStep: v.pipe(v.number(), v.gtValue(0)),
  frames: v.pipe(
    v.array(
      v.strictObject({
        /** Thousands of years ago. */
        ka: v.pipe(v.number(), v.minValue(0)),
        file: v.pipe(v.string(), v.regex(/^\d+\.png$/)),
        /** Share of Earth's surface under ice. */
        ice: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
      }),
    ),
    v.minLength(1),
    v.check(
      (frames) =>
        frames.every((frame, index) => index === 0 || frame.ka > (frames[index - 1]?.ka ?? 0)),
      'frames run from the present back in time',
    ),
  ),
});

export type IceSheetIndex = v.InferOutput<typeof IndexSchema>;

export async function loadIceSheets(url: string, fetchJson: Fetch): Promise<IceSheetIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

/** The oldest moment the ice maps reach, thousands of years ago. */
export function oldestIceKa(index: IceSheetIndex): number {
  return index.frames.at(-1)?.ka ?? 0;
}

/** The frames in millions of years, for blending like the other deep-time maps. */
export function iceFramesInMa(
  index: IceSheetIndex,
): readonly { readonly ma: number; readonly file: string; readonly ice: number }[] {
  return index.frames.map(({ ka, file, ice }) => ({ ma: ka / 1000, file, ice }));
}
