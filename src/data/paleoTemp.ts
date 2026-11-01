/**
 * Surface temperature since 540 Ma (`public/data/paleotemp/`), from Scotese's paleotemperature
 * maps (Scotese 2022, CC BY 4.0), packed into greyscale images by the pipeline's `paleotemp`
 * command: bytes 0–255 run linearly from `coldest` to `warmest` °C. The steps differ from the
 * elevation maps': every 5 million years to 450 Ma, every 10 before.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const celsius = v.pipe(v.number(), v.minValue(-100), v.maxValue(100));

const IndexSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
    rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
    coldest: celsius,
    warmest: celsius,
    frames: v.pipe(
      v.array(
        v.strictObject({
          ma: v.pipe(v.number(), v.integer(), v.minValue(0)),
          file: v.pipe(v.string(), v.regex(/^\d+\.png$/)),
          /** Area-weighted global mean, °C. */
          mean: celsius,
          /** What the site says about a map that stands out. */
          note: v.optional(v.pipe(v.string(), v.minLength(1))),
        }),
      ),
      v.minLength(1),
      v.check(
        (frames) =>
          frames.every((frame, index) => index === 0 || frame.ma > (frames[index - 1]?.ma ?? 0)),
        'frames run from the present back in time',
      ),
    ),
  }),
  v.check(({ coldest, warmest }) => coldest < warmest, 'coldest is below warmest'),
);

export type PaleoTempIndex = v.InferOutput<typeof IndexSchema>;
export type PaleoTempFrame = PaleoTempIndex['frames'][number];

export async function loadPaleoTempIndex(url: string, fetchJson: Fetch): Promise<PaleoTempIndex> {
  return getJson(fetchJson, url, IndexSchema);
}
