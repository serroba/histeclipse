/**
 * Today's coasts and shelves (`public/data/shelf/`), from ETOPO1 (NOAA), packed by the
 * pipeline's `shelf` command one metre a byte from `lowest` to `highest` around today's sea
 * level, for drawing coastlines at past sea levels.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

const IndexSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    file: v.pipe(v.string(), v.regex(/^[a-z]+\.png$/)),
    columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
    rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
    lowest: v.number(),
    highest: v.number(),
  }),
  v.check(({ lowest, highest }) => lowest < 0 && highest > 0, 'the band spans today’s sea level'),
);

export type ShelfIndex = v.InferOutput<typeof IndexSchema>;

export async function loadShelf(url: string, fetchJson: Fetch): Promise<ShelfIndex> {
  return getJson(fetchJson, url, IndexSchema);
}
