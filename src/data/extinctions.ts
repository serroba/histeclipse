/**
 * The great extinctions' places (`public/data/extinctions.json`), by the pipeline's
 * `extinctions` command: where each was caused, or is held or argued to have been, and where it
 * is dated, each with its place every 5 million years back on the PALEOMAP reconstruction (the
 * deep-time maps'), to the step past its extinction.
 */

import * as v from 'valibot';

import type { GeoPoint } from '../core/geo';
import { getJson, type Fetch } from '../util/fetchJson';
import { pointThen } from './placesThen';

const integer = v.pipe(v.number(), v.integer());

const ExtinctionSitesSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
  stepMa: v.pipe(v.number(), v.gtValue(0)),
  scale: v.pipe(v.number(), v.gtValue(0)),
  sites: v.array(
    v.strictObject({
      id: v.pipe(v.string(), v.minLength(1)),
      /** The extinction's id. */
      extinction: v.pipe(v.string(), v.minLength(1)),
      name: v.pipe(v.string(), v.minLength(1)),
      /** What caused it, or is held or argued to have; or where it is dated. */
      role: v.picklist(['cause', 'record']),
      /** Its place at each step back from today, latitude and longitude × scale; null on no plate. */
      then: v.pipe(v.array(v.nullable(v.tuple([integer, integer]))), v.minLength(1)),
    }),
  ),
});

export type ExtinctionSites = v.InferOutput<typeof ExtinctionSitesSchema>;
export type ExtinctionSite = ExtinctionSites['sites'][number];

export async function loadExtinctionSites(url: string, fetchJson: Fetch): Promise<ExtinctionSites> {
  return getJson(fetchJson, url, ExtinctionSitesSchema);
}

/** Where a site lay `ma` million years ago, between the steps around it; null past its steps. */
export function siteThen(data: ExtinctionSites, site: ExtinctionSite, ma: number): GeoPoint | null {
  return pointThen(site.then, data, ma);
}
