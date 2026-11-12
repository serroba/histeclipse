/**
 * How people lived around the world over the last 10,000 years (`public/data/ways-of-life.json`),
 * from ArchaeoGLOBE (2019, CC0) by the pipeline's `ways` command: for 146 regions, the
 * archaeologists' consensus on how widespread five ways of life were at ten moments, from none
 * (0) to widespread (3).
 */

import * as v from 'valibot';

import { elementAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

export const WAYS = ['foraging', 'pastoralism', 'extensive', 'intensive', 'urban'] as const;
type Way = (typeof WAYS)[number];

const Level = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3));

const WaysSchema = v.strictObject({
  schemaVersion: v.literal(1),
  credit: v.pipe(v.string(), v.minLength(1)),
  source: v.pipe(v.string(), v.url()),
  scale: v.pipe(v.number(), v.gtValue(0)),
  /** The moments rated, astronomical years, oldest first. */
  years: v.pipe(v.array(v.pipe(v.number(), v.integer())), v.minLength(1)),
  ways: v.tuple([
    v.literal('foraging'),
    v.literal('pastoralism'),
    v.literal('extensive'),
    v.literal('intensive'),
    v.literal('urban'),
  ]),
  regions: v.array(
    v.strictObject({
      id: v.pipe(v.number(), v.integer()),
      name: v.pipe(v.string(), v.minLength(1)),
      rings: v.array(v.array(v.pipe(v.number(), v.integer()))),
      levels: v.strictObject({
        foraging: v.array(Level),
        pastoralism: v.array(Level),
        extensive: v.array(Level),
        intensive: v.array(Level),
        urban: v.array(Level),
      }),
    }),
  ),
});

export type WaysOfLife = v.InferOutput<typeof WaysSchema>;

export async function loadWaysOfLife(url: string, fetchJson: Fetch): Promise<WaysOfLife> {
  return getJson(fetchJson, url, WaysSchema);
}

/** A region's most widespread way of life, or mixed where several are as widespread. */
export type Shown = Way | 'mixed';

/** A region coloured by its most widespread way of life at a moment. */
export interface WayRegion {
  readonly name: string;
  readonly rings: readonly (readonly (readonly [number, number])[])[];
  readonly way: Shown;
  /** The ways as widespread as the one shown (two or more when mixed). */
  readonly ways: readonly Way[];
  /** How widespread: 1 minimal, 2 common, 3 widespread. */
  readonly level: 1 | 2 | 3;
}

export interface WaysAt {
  /** The moment rated nearest the year shown, astronomical. */
  readonly year: number;
  readonly regions: readonly WayRegion[];
  /** Regions where each way of life is the most widespread, in WAYS's order. */
  readonly counts: Readonly<Record<Shown, number>>;
}

/**
 * The regions as rated at the moment nearest `year`, each by its most widespread way of life;
 * where several are as widespread, mixed, naming them, rather than picking one. A region rated
 * none for every way is left out.
 */
export function waysAt(data: WaysOfLife, year: number): WaysAt {
  const moment = data.years.reduce(
    (best, candidate, index) =>
      Math.abs(candidate - year) < Math.abs(elementAt(data.years, best) - year) ? index : best,
    0,
  );
  const counts: Record<Shown, number> = {
    foraging: 0,
    pastoralism: 0,
    extensive: 0,
    intensive: 0,
    urban: 0,
    mixed: 0,
  };
  const regions = data.regions.flatMap((region): WayRegion[] => {
    const level = Math.max(...WAYS.map((each) => elementAt(region.levels[each], moment)));
    if (level === 0) return [];
    const ways = WAYS.filter((each) => elementAt(region.levels[each], moment) === level);
    const [only] = ways;
    const way: Shown = ways.length === 1 && only !== undefined ? only : 'mixed';
    counts[way] += 1;
    const rings = region.rings.map((ring) => {
      const points: [number, number][] = [];
      for (let at = 0; at + 1 < ring.length; at += 2) {
        points.push([elementAt(ring, at) / data.scale, elementAt(ring, at + 1) / data.scale]);
      }
      return points;
    });
    return [{ name: region.name, rings, way, ways, level: level as 1 | 2 | 3 }];
  });
  return { year: elementAt(data.years, moment), regions, counts };
}

export const WAY_NAMES: Readonly<Record<Shown, string>> = {
  foraging: 'foraging',
  pastoralism: 'herding',
  extensive: 'farming',
  intensive: 'intensive farming',
  urban: 'towns and cities',
  mixed: 'mixed, several as widespread',
};

/** What the Layers panel says of the ways of life shown. */
export function waysNote(at: WaysAt, formatYear: (year: number) => string): string {
  const most = [...WAYS, 'mixed' as const]
    .filter((way) => at.counts[way] > 0)
    .map((way) => `${WAY_NAMES[way]} ${String(at.counts[way])}`)
    .join(', ');
  return `As rated for ${formatYear(at.year)}, the nearest moment ArchaeoGLOBE rates; the most widespread way of life, by region: ${most}.`;
}
