/**
 * A fossil group's genera through time, place and climate (`public/data/life-stories/`): the
 * Paleobiology Database's classification and finds (CC BY 4.0), each genus's sites every 5
 * million years with the part of today's world its finds are in and the temperature there then
 * on Scotese's (2022) maps. Written by the pipeline's `life_stories`. An animal's story is
 * told from one of these files, with its pictures and the continents' doors beside it.
 */

import * as v from 'valibot';

import { elementAt, valueAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';
import { HEADER } from './header';

export const LIFE_GROUPS = ['mammals', 'dinosaurs'] as const;
export type LifeGroup = (typeof LIFE_GROUPS)[number];

const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const Age = v.pipe(v.number(), v.minValue(0), v.maxValue(4600));
/** How many numbers a site takes in a genus's `sites`. */
const SITE = 6;

const LifeSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    ...HEADER,
    source: v.pipe(v.string(), v.url()),
    id: v.picklist(LIFE_GROUPS),
    name: v.pipe(v.string(), v.minLength(1)),
    stepMa: v.pipe(v.number(), v.gtValue(0)),
    ranks: v.pipe(v.array(v.string()), v.minLength(1)),
    regions: v.pipe(v.array(v.string()), v.minLength(1)),
    pbdb: v.array(Count),
    names: v.pipe(v.array(v.string()), v.minLength(1)),
    common: v.array(v.string()),
    living: v.array(v.picklist([0, 1])),
    rank: v.array(Count),
    parent: v.array(v.pipe(v.number(), v.integer(), v.minValue(-1))),
    first: v.array(Age),
    last: v.array(Age),
    /** Each genus's sites as [Ma, latitude, longitude, finds, region, °C or null, …]. */
    sites: v.array(v.array(v.nullable(v.number()))),
    /** The globe's mean temperature at each map's age: [Ma, °C]. */
    globe: v.array(v.tuple([Age, v.number()])),
  }),
  v.check((file) => {
    const count = file.names.length;
    return [
      file.pbdb,
      file.common,
      file.living,
      file.rank,
      file.parent,
      file.first,
      file.last,
      file.sites,
    ]
      .map((column) => column.length)
      .every((length) => length === count);
  }, 'every column has a value for each node'),
  v.check(
    (file) =>
      file.parent.every((parent, index) =>
        index === 0 ? parent === -1 : parent >= 0 && parent < index,
      ) &&
      file.rank.every((rank) => rank < file.ranks.length) &&
      file.sites.every((sites) => sites.length % SITE === 0),
    'each node comes after its parent, and ranks and sites are well formed',
  ),
);

/** Where some of a genus's finds lay, in one step. */
export interface LifeSite {
  /** The middle of the step its finds fall in (Ma), a map's age. */
  readonly ma: number;
  /** Where it lay then. */
  readonly latitude: number;
  readonly longitude: number;
  readonly finds: number;
  /** The part of today's world its finds are in: an index into the group's `regions`. */
  readonly region: number;
  /** The mean annual temperature there then, °C, on Scotese's map; null where it has none. */
  readonly celsius: number | null;
}

export interface LifeNode {
  readonly index: number;
  readonly pbdb: number;
  readonly name: string;
  /** PBDB's common name for it, or ''. */
  readonly common: string;
  readonly rank: string;
  readonly parent: number;
  readonly children: readonly number[];
  /** Whether PBDB marks it as living today. */
  readonly living: boolean;
  /** Its sites, oldest first; empty for a group. */
  readonly sites: readonly LifeSite[];
}

export interface LifeData {
  readonly id: LifeGroup;
  readonly name: string;
  readonly credit: string;
  readonly source: string;
  readonly accessed: string;
  readonly stepMa: number;
  readonly regions: readonly string[];
  readonly nodes: readonly LifeNode[];
  /** The globe's mean temperature, °C, by a map's age (Ma). */
  readonly globe: ReadonlyMap<number, number>;
}

export function parseLife(raw: unknown): LifeData {
  const file = v.parse(LifeSchema, raw);
  const children: number[][] = file.names.map(() => []);
  file.parent.forEach((parent, index) => {
    if (parent >= 0) elementAt(children, parent).push(index);
  });
  const nodes = file.names.map((name, index): LifeNode => {
    const flat = elementAt(file.sites, index);
    const sites: LifeSite[] = [];
    for (let at = 0; at + SITE <= flat.length; at += SITE) {
      const [ma, latitude, longitude, finds, region, celsius] = flat.slice(at, at + SITE);
      if (
        typeof ma !== 'number' ||
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        typeof finds !== 'number' ||
        typeof region !== 'number'
      ) {
        throw new Error(`${name}: a site lacks its moment, place, finds or region`);
      }
      sites.push({ ma, latitude, longitude, finds, region, celsius: celsius ?? null });
    }
    sites.sort((a, b) => b.ma - a.ma || b.finds - a.finds);
    return {
      index,
      pbdb: valueAt(file.pbdb, index),
      name,
      common: elementAt(file.common, index),
      rank: elementAt(file.ranks, valueAt(file.rank, index)),
      parent: valueAt(file.parent, index),
      children: elementAt(children, index),
      living: elementAt(file.living, index) === 1,
      sites,
    };
  });
  return {
    id: file.id,
    name: file.name,
    credit: file.credit,
    source: file.source,
    accessed: file.accessed,
    stepMa: file.stepMa,
    regions: file.regions,
    nodes,
    globe: new Map(file.globe),
  };
}

export async function loadLife(url: string, fetchJson: Fetch): Promise<LifeData> {
  return parseLife(await getJson(fetchJson, url, v.unknown()));
}
