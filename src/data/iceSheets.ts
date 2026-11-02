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

/** An ice map standing in for a moment older than the maps, matched by sea level. */
export interface IceStandIn {
  /** The frame shown: thousands of years ago. */
  readonly ka: number;
  readonly file: string;
  /** Sea level then and at the moment shown, metres from today's. */
  readonly frameLevel: number;
  readonly level: number;
}

/**
 * Before the ice maps reach, the map whose sea level is closest to the moment's: sea level
 * mostly measures how much water the ice sheets hold, so it picks a map of about the right
 * amount of ice. The ice sheets' shapes then may have differed. `levelAt` gives sea level
 * (metres from today's) thousands of years ago, or null where its source does not reach.
 */
export function iceStandIn(
  index: IceSheetIndex,
  level: number,
  levelAt: (ka: number) => number | null,
): IceStandIn | null {
  let best: IceStandIn | null = null;
  for (const { ka, file } of index.frames) {
    const frameLevel = levelAt(ka);
    if (frameLevel === null) continue;
    if (best === null || Math.abs(frameLevel - level) < Math.abs(best.frameLevel - level)) {
      best = { ka, file, frameLevel, level };
    }
  }
  return best;
}
