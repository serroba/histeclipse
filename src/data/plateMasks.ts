/**
 * Where the continents were in a second reconstruction (`public/data/plates/`): Cao et al.
 * (2024, CC BY 4.0), reconstructed with pyGPlates by the `data-pipeline/plates` project and
 * drawn as 0.25° masks every 5 million years back to 1,800 Ma.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const IndexSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
  columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
  frames: v.pipe(
    v.array(
      v.strictObject({
        ma: v.pipe(v.number(), v.integer(), v.minValue(0)),
        file: v.pipe(v.string(), v.regex(/^\d+\.png$/)),
        /** Share of the surface inside a continent. */
        continents: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
        /**
         * Where PALEOMAP reaches: the turn east about the axis, degrees, that lines these
         * continents up with its map (longitude is not fixed by rock magnetism), and the share
         * of its land inside them as published and turned.
         */
        turn: v.optional(v.pipe(v.number(), v.minValue(-180), v.maxValue(180))),
        landInside: v.optional(
          v.strictObject({
            asPublished: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            turned: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
          }),
        ),
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

export type PlateMaskIndex = v.InferOutput<typeof IndexSchema>;

export async function loadPlateMasks(url: string, fetchJson: Fetch): Promise<PlateMaskIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

export type PlateFrame = PlateMaskIndex['frames'][number];

/** What the bar says about the outlines at a frame: how they were lined up, and how well. */
export function plateText(frame: PlateFrame): string {
  const credit =
    'Outlined: the continents in a second reconstruction, Cao et al. 2024 (CC BY 4.0).';
  if (frame.turn === undefined || frame.landInside === undefined) {
    return `${credit} No surface map reaches this far to compare with; only crust that survives today is carried back.`;
  }
  const degrees = Math.abs(frame.turn);
  const way = frame.turn < 0 ? 'west' : 'east';
  const turned =
    degrees < 0.5
      ? 'They line up with the surface map as published.'
      : `Turned ${degrees.toFixed(0)}° ${way} to line up with the surface map: rock magnetism fixes latitude, not longitude, so each reconstruction picks its own.`;
  const percent = (share: number): string => `${String(Math.round(share * 100))}%`;
  return `${credit} ${turned} ${percent(frame.landInside.turned)} of the surface map’s land lies inside them (${percent(frame.landInside.asPublished)} as published); where outline and coast part, the two disagree.`;
}
