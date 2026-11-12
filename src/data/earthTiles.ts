/**
 * The manifest of Earth's tiles (`public/textures/earth-tiles/manifest.json`), written by the
 * pipeline's `earth-tiles` command (#568): the levels of the pyramid there are, each with the
 * map it was cut from, pinned by checksum, and where a tile's file is.
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
    source: v.strictObject({
      url: v.pipe(v.string(), v.url()),
      sha256: v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/)),
    }),
  }),
  v.check(
    ({ z, columns, rows }) => columns === 2 ** (z + 1) && rows === 2 ** z,
    'level z is 2^(z+1) tiles across and 2^z down',
  ),
);

const EarthTilesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    tileSize: v.pipe(count, v.maxValue(4096)),
    path: v.literal('{z}/{x}/{y}.webp'),
    levels: v.pipe(v.array(LevelSchema), v.minLength(1)),
  }),
  v.check(
    ({ levels }) => levels.every((level, i) => i === 0 || elementAt(levels, i - 1).z < level.z),
    'levels come coarsest first',
  ),
);

export type EarthTiles = v.InferOutput<typeof EarthTilesSchema>;

export async function loadEarthTiles(url: string, fetchJson: Fetch): Promise<EarthTiles> {
  return getJson(fetchJson, url, EarthTilesSchema);
}

/** The address of a tile's file under the manifest's folder. */
export function tilePath(tiles: EarthTiles, z: number, x: number, y: number): string {
  return tiles.path.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
}
