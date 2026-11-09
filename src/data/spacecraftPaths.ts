/**
 * Where the craft beyond Earth orbit went, as JPL Horizons gives it (#350):
 * `public/data/spacecraft-paths.json`, written by the pipeline's `spacecraft-paths` command, for
 * the craft Horizons has (some 110 of the record's). Each path is pieces: positions about the
 * Sun or Earth (ICRF, km), thinned to as few as draw it within a set distance, or a long stay
 * at another world, during which the craft is at that world.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

/** Days since JD 2400000 (TT), and km on each axis. */
const PointSchema = v.tuple([v.number(), v.number(), v.number(), v.number()]);

const PieceSchema = v.union([
  v.strictObject({
    centre: v.picklist(['Sun', 'Earth']),
    points: v.pipe(v.array(PointSchema), v.minLength(1)),
  }),
  v.strictObject({
    at: v.pipe(v.string(), v.minLength(1)),
    from: v.pipe(v.string(), v.isoDate()),
    to: v.nullable(v.pipe(v.string(), v.isoDate())),
  }),
]);

const PathsSchema = v.strictObject({
  schemaVersion: v.literal(1),
  source: v.pipe(v.string(), v.url()),
  paths: v.record(v.string(), v.pipe(v.array(PieceSchema), v.minLength(1))),
});

export type PathPiece = v.InferOutput<typeof PieceSchema>;
export type CraftPaths = v.InferOutput<typeof PathsSchema>['paths'];

export async function loadSpacecraftPaths(url: string, fetchJson: Fetch): Promise<CraftPaths> {
  return (await getJson(fetchJson, url, PathsSchema)).paths;
}

const JD_BASE = 2_400_000;
/** JD (TT) of midnight starting an ISO date. */
function isoJd(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 2_440_587.5;
}

/** Where a craft is at a moment: about the Sun or Earth (ICRF, km), or at a world. */
export type CraftWhere =
  | { readonly centre: 'Sun' | 'Earth'; readonly km: readonly [number, number, number] }
  | { readonly at: string };

/**
 * Where a craft's path puts it at `jdTT`: between the two kept points about that moment, at
 * the moment's share of the way; at a world during a long stay; null outside its path.
 */
export function craftAt(pieces: readonly PathPiece[], jdTT: number): CraftWhere | null {
  const t = jdTT - JD_BASE;
  for (const piece of pieces) {
    if ('at' in piece) {
      const from = isoJd(piece.from) - JD_BASE;
      const to = piece.to === null ? Infinity : isoJd(piece.to) - JD_BASE;
      if (t >= from && t <= to) return { at: piece.at };
      continue;
    }
    const { points } = piece;
    if (t < elementAt(points, 0)[0] || t > elementAt(points, points.length - 1)[0]) continue;
    let low = 0;
    let high = points.length - 1;
    // The last point at or before the moment.
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (elementAt(points, middle)[0] <= t) low = middle;
      else high = middle;
    }
    const [t0, x0, y0, z0] = elementAt(points, low);
    const [t1, x1, y1, z1] = elementAt(points, high);
    const share = t1 === t0 ? 0 : (t - t0) / (t1 - t0);
    return {
      centre: piece.centre,
      km: [x0 + share * (x1 - x0), y0 + share * (y1 - y0), z0 + share * (z1 - z0)],
    };
  }
  return null;
}
