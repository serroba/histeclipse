/**
 * Outlines of the Northern Hemisphere's ice sheets through the Quaternary
 * (`public/data/icesheets/batchelor.json`), from Batchelor et al. (2019), reprojected and
 * simplified by the pipeline's `iceoutlines` command: for 17 time slices a minimum, a best
 * estimate and a maximum extent, and for the Last Glacial Maximum a best estimate. Each ring is
 * delta-encoded (schema 2, #221), which halves the file once compressed.
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';
import { HEADER_ADDED } from './header';

/** Rings as flat [lon, lat, lon, lat, …] × scale. */
const Rings = v.array(
  v.pipe(
    v.array(v.pipe(v.number(), v.integer())),
    v.check((ring) => ring.length >= 6 && ring.length % 2 === 0, 'rings are lon/lat pairs'),
  ),
);

const OutlinesSchema = v.strictObject({
  // 2 (#221): each ring delta-encoded, its first point then each step from the one before.
  schemaVersion: v.literal(2),
  ...HEADER_ADDED,
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  scale: v.pipe(v.number(), v.gtValue(0)),
  slices: v.array(
    v.strictObject({
      name: v.pipe(v.string(), v.minLength(1)),
      /** The span, thousands of years ago. */
      fromKa: v.pipe(v.number(), v.minValue(0)),
      toKa: v.pipe(v.number(), v.minValue(0)),
      min: Rings,
      best: Rings,
      max: Rings,
    }),
  ),
});

export type IceOutlineIndex = v.InferOutput<typeof OutlinesSchema>;

type Ring = readonly (readonly [number, number])[];

/** One time slice's hypotheses, in degrees; a hypothesis the authors did not give is empty. */
export interface IceOutlines {
  readonly name: string;
  readonly fromKa: number;
  readonly toKa: number;
  readonly min: readonly Ring[];
  readonly best: readonly Ring[];
  readonly max: readonly Ring[];
}

export async function loadIceOutlines(url: string, fetchJson: Fetch): Promise<IceOutlineIndex> {
  return getJson(fetchJson, url, OutlinesSchema);
}

/**
 * The time slice shown `ka` thousand years ago, or null between them. Where two slices'
 * spans meet, the one whose middle is nearer wins.
 */
export function iceOutlinesAt(index: IceOutlineIndex, ka: number): IceOutlines | null {
  const middle = (slice: { fromKa: number; toKa: number }) => (slice.fromKa + slice.toKa) / 2;
  const slice = index.slices
    .filter((each) => each.fromKa <= ka && ka <= each.toKa)
    .sort((a, b) => Math.abs(middle(a) - ka) - Math.abs(middle(b) - ka))[0];
  if (slice === undefined) return null;
  const degrees = (rings: readonly (readonly number[])[]): Ring[] =>
    rings.map((ring) => {
      // Undo the delta encoding: each point is the one before plus its step.
      const points: [number, number][] = [];
      let lon = 0;
      let lat = 0;
      for (let at = 0; at + 1 < ring.length; at += 2) {
        lon += elementAt(ring, at);
        lat += elementAt(ring, at + 1);
        points.push([lon / index.scale, lat / index.scale]);
      }
      return points;
    });
  return {
    name: slice.name,
    fromKa: slice.fromKa,
    toKa: slice.toKa,
    min: degrees(slice.min),
    best: degrees(slice.best),
    max: degrees(slice.max),
  };
}
