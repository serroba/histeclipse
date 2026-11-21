/**
 * The manifest of today's heights in tiles (`public/textures/relief-tiles/manifest.json`), written
 * by the pipeline's `relief-tiles` command (#1015): ETOPO 2022 at 4′ (level 2), 2′ (level 3) and
 * 1′ (level 4, only where there is land or shelf, #1030), for the ice-age globe close up (#1016).
 * The tiles are addressed as the Blue Marble's (#568); each has `tileSize` cells a side and
 * `border` of its neighbours' round them.
 *
 * A cell is three bytes: the height plus `offset` metres, high byte (red) then low (green), and
 * where water is (blue): 255 the ocean, 128 a lake or inland sea, 0 land.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const count = v.pipe(v.number(), v.integer(), v.minValue(1));

const LevelSchema = v.pipe(
  v.strictObject({
    z: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(10)),
    columns: count,
    rows: count,
    // The tiles a level leaves out, as `x/y` (#1030): the next coarser level is drawn there.
    missing: v.optional(v.array(v.pipe(v.string(), v.regex(/^\d+\/\d+$/)))),
  }),
  v.check(
    ({ z, columns, rows }) => columns === 2 ** (z + 1) && rows === 2 ** z,
    'level z is 2^(z+1) tiles across and 2^z down',
  ),
);

const ReliefTilesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    tileSize: v.pipe(count, v.maxValue(4096)),
    border: v.pipe(v.number(), v.integer(), v.minValue(2), v.maxValue(8)),
    path: v.literal('{z}/{x}/{y}.webp'),
    offset: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(65535)),
    // The shader reads these bytes as they are (`earthShader.ts`).
    water: v.strictObject({ ocean: v.literal(255), lake: v.literal(128), land: v.literal(0) }),
    levels: v.pipe(v.array(LevelSchema), v.minLength(1)),
    sources: v.pipe(
      v.array(
        v.strictObject({
          url: v.pipe(v.string(), v.url()),
          sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
        }),
      ),
      v.minLength(1),
    ),
  }),
  v.check(
    ({ levels }) => levels.every((level, i) => i === 0 || elementAt(levels, i - 1).z < level.z),
    'levels come coarsest first',
  ),
);

export type ReliefTiles = v.InferOutput<typeof ReliefTilesSchema>;

export async function loadReliefTiles(url: string, fetchJson: Fetch): Promise<ReliefTiles> {
  return getJson(fetchJson, url, ReliefTilesSchema);
}
