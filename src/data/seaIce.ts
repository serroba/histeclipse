/**
 * Sea ice (`public/data/seaice/`), from the pipeline's `seaice` command: today's from NSIDC
 * (1981–2010) and the Last Glacial Maximum's from three PMIP4 climate models. Each source has two
 * maps: the most ice in the year and the ice that lasts all year, a byte per 0.4% of cover.
 *
 * Between today and the glacial maximum the ice is blended by sea level: how far the sea had
 * fallen towards its glacial low. That is a stand-in, not a reconstruction; the bar says so.
 */

import * as v from 'valibot';

import { getJson, type Fetch } from './fetchJson';

export const SEA_ICE_MODELS = ['mpi-esm1-2-lr', 'miroc-es2l', 'awi-esm-1-1-lr'] as const;
export type SeaIceModel = (typeof SEA_ICE_MODELS)[number];
export const DEFAULT_SEA_ICE_MODEL: SeaIceModel = 'mpi-esm1-2-lr';

const SourceSchema = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1)),
  label: v.pipe(v.string(), v.minLength(1)),
  era: v.picklist(['today', 'lgm']),
  credit: v.pipe(v.string(), v.minLength(1)),
  most: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.png$/)),
  yearRound: v.pipe(v.string(), v.regex(/^[a-z0-9-]+\.png$/)),
  /** Share of Earth's surface with at least 15% cover at some time of year. */
  extent: v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
});

const IndexSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    columns: v.pipe(v.number(), v.integer(), v.minValue(2)),
    rows: v.pipe(v.number(), v.integer(), v.minValue(2)),
    stepsPerPercent: v.pipe(v.number(), v.gtValue(0)),
    sources: v.array(SourceSchema),
  }),
  v.check(
    (index) => index.sources.filter(({ era }) => era === 'today').length === 1,
    'exactly one source of today’s sea ice',
  ),
);

export type SeaIceIndex = v.InferOutput<typeof IndexSchema>;
export type SeaIceSource = SeaIceIndex['sources'][number];

export async function loadSeaIce(url: string, fetchJson: Fetch): Promise<SeaIceIndex> {
  return getJson(fetchJson, url, IndexSchema);
}

/** Today's source and an ice-age model's, or null if the index lacks either. */
export function seaIcePair(
  index: SeaIceIndex,
  model: SeaIceModel,
): { readonly today: SeaIceSource; readonly past: SeaIceSource } | null {
  const today = index.sources.find(({ era }) => era === 'today');
  const past = index.sources.find(({ id, era }) => id === model && era === 'lgm');
  return today === undefined || past === undefined ? null : { today, past };
}

/**
 * How far from today's sea ice towards the glacial maximum's, 0 to 1: the share of the sea's fall
 * from today's level to its glacial low, by the same source. Above today's level, 0.
 */
export function seaIceMix(level: number, glacialLevel: number): number {
  if (glacialLevel >= 0) return 0;
  return Math.min(1, Math.max(0, level / glacialLevel));
}
