/**
 * A fossil group's genera through time and place (`public/data/time-tree/<group>.json`, #358):
 * the Paleobiology Database's classification (CC BY 4.0) with each genus's first and last
 * appearance and where its finds lay, every 5 million years, on the PALEOMAP reconstruction.
 * Written by the pipeline's `time-tree` command. Nodes are columns, each after its parent and
 * siblings oldest first; a genus has a track, a group (family, order…) has none.
 *
 * This places each line in time and space: a genus drifts with its finds, and a group starts
 * where and when its oldest member does. A group's place is an estimate of that kind, not a
 * find of its own.
 */

import * as v from 'valibot';

import { elementAt, valueAt } from '../util/arrays';
import { getJson, type Fetch } from './fetchJson';

export const LINEAGE_GROUPS = ['trilobites', 'ammonoids', 'dinosaurs', 'mammals'] as const;
export type LineageGroup = (typeof LINEAGE_GROUPS)[number];

const Count = v.pipe(v.number(), v.integer(), v.minValue(0));
const Age = v.pipe(v.number(), v.minValue(0), v.maxValue(4600));

const LineagesSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    id: v.picklist(LINEAGE_GROUPS),
    name: v.pipe(v.string(), v.minLength(1)),
    stepMa: v.pipe(v.number(), v.gtValue(0)),
    ranks: v.pipe(v.array(v.string()), v.minLength(1)),
    pbdb: v.array(Count),
    names: v.pipe(v.array(v.string()), v.minLength(1)),
    rank: v.array(Count),
    parent: v.array(v.pipe(v.number(), v.integer(), v.minValue(-1))),
    first: v.array(Age),
    last: v.array(Age),
    species: v.array(Count),
    /** Each genus's track as [step Ma, latitude, longitude, finds, …]; empty for a group. */
    tracks: v.array(v.array(v.number())),
  }),
  v.check((file) => {
    const count = file.names.length;
    return [file.pbdb, file.rank, file.parent, file.first, file.last, file.species, file.tracks]
      .map((column) => column.length)
      .every((length) => length === count);
  }, 'every column has a value for each node'),
  v.check(
    (file) =>
      file.parent.every((parent, index) =>
        index === 0 ? parent === -1 : parent >= 0 && parent < index,
      ) &&
      file.rank.every((rank) => rank < file.ranks.length) &&
      file.tracks.every((track) => track.length % 4 === 0),
    'each node comes after its parent, and ranks and tracks are well formed',
  ),
);

export interface Place {
  readonly latitude: number;
  readonly longitude: number;
}

export interface TrackPoint extends Place {
  /** The middle of the 5-million-year step its finds fall in (Ma). */
  readonly ma: number;
  readonly finds: number;
}

export interface Lineage {
  readonly index: number;
  /** PBDB's number for the name, for links to its page. */
  readonly pbdb: number;
  readonly name: string;
  readonly rank: string;
  /** Index of its parent, -1 for the group itself. */
  readonly parent: number;
  readonly children: readonly number[];
  /** First and last appearance, Ma (0: still living). */
  readonly first: number;
  readonly last: number;
  /** How many valid species PBDB lists in it (genera only). */
  readonly species: number;
  /** Where its finds lay, oldest first; empty for a group. */
  readonly track: readonly TrackPoint[];
}

export interface Lineages {
  readonly id: LineageGroup;
  readonly name: string;
  readonly credit: string;
  readonly source: string;
  readonly accessed: string;
  readonly stepMa: number;
  readonly nodes: readonly Lineage[];
}

export function parseLineages(raw: unknown): Lineages {
  const file = v.parse(LineagesSchema, raw);
  const children: number[][] = file.names.map(() => []);
  file.parent.forEach((parent, index) => {
    if (parent >= 0) elementAt(children, parent).push(index);
  });
  const nodes = file.names.map((name, index): Lineage => {
    const flat = elementAt(file.tracks, index);
    const track: TrackPoint[] = [];
    for (let at = 0; at + 3 < flat.length; at += 4) {
      track.push({
        ma: valueAt(flat, at) + file.stepMa / 2,
        latitude: valueAt(flat, at + 1),
        longitude: valueAt(flat, at + 2),
        finds: valueAt(flat, at + 3),
      });
    }
    // Oldest first, and never outside the genus's own span.
    const first = valueAt(file.first, index);
    const last = valueAt(file.last, index);
    track.sort((a, b) => b.ma - a.ma);
    return {
      index,
      pbdb: valueAt(file.pbdb, index),
      name,
      rank: elementAt(file.ranks, valueAt(file.rank, index)),
      parent: valueAt(file.parent, index),
      children: elementAt(children, index),
      first,
      last,
      species: valueAt(file.species, index),
      track: track.map((point) => ({ ...point, ma: Math.min(first, Math.max(last, point.ma)) })),
    };
  });
  return {
    id: file.id,
    name: file.name,
    credit: file.credit,
    source: file.source,
    accessed: file.accessed,
    stepMa: file.stepMa,
    nodes,
  };
}

export async function loadLineages(url: string, fetchJson: Fetch): Promise<Lineages> {
  return parseLineages(await getJson(fetchJson, url, v.unknown()));
}

export function isGenus(node: Lineage): boolean {
  return node.track.length > 0;
}

/** Whether a genus was living at `ma`. */
export function aliveAt(node: Lineage, ma: number): boolean {
  return isGenus(node) && ma <= node.first && ma >= node.last;
}

/** Wrap a longitude into [-180, 180). */
function wrap(longitude: number): number {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

/**
 * Where a genus's finds lay at `ma`: between two steps, part way from one place to the next
 * (the short way round); before its first step or after its last, that step's place.
 */
export function trackAt(track: readonly TrackPoint[], ma: number): Place {
  const oldest = elementAt(track, 0);
  if (ma >= oldest.ma) return placeOf(oldest);
  for (let at = 1; at < track.length; at++) {
    const younger = elementAt(track, at);
    if (ma >= younger.ma) {
      const older = elementAt(track, at - 1);
      const span = older.ma - younger.ma;
      const share = span === 0 ? 0 : (older.ma - ma) / span;
      let turn = younger.longitude - older.longitude;
      if (turn > 180) turn -= 360;
      if (turn < -180) turn += 360;
      return {
        latitude: older.latitude + share * (younger.latitude - older.latitude),
        longitude: wrap(older.longitude + share * turn),
      };
    }
  }
  return placeOf(elementAt(track, track.length - 1));
}

function placeOf(point: Place): Place {
  return { latitude: point.latitude, longitude: point.longitude };
}

export interface Origin extends Place {
  readonly ma: number;
}

/**
 * Where and when each line starts: a genus at its first appearance, where its oldest finds lay;
 * a group where and when its oldest member starts.
 */
export function origins(lineages: Lineages): readonly Origin[] {
  const out: Origin[] = [];
  // Children come after parents, so settle them from the end.
  for (let index = lineages.nodes.length - 1; index >= 0; index--) {
    const node = elementAt(lineages.nodes, index);
    if (isGenus(node)) {
      out[index] = { ma: node.first, ...trackAt(node.track, node.first) };
      continue;
    }
    let oldest: Origin | undefined;
    for (const child of node.children) {
      const origin = out[child];
      if (origin !== undefined && (oldest === undefined || origin.ma > oldest.ma)) oldest = origin;
    }
    out[index] = oldest ?? { ma: node.first, latitude: 0, longitude: 0 };
  }
  return out;
}

/** The radial tree's layout: each node's angle (radians), and the angles its members span. */
export interface Fan {
  readonly angle: readonly number[];
  /** The smallest and largest angle of its members; a leaf's are its own. */
  readonly low: readonly number[];
  readonly high: readonly number[];
  /** The genera in order round the circle. */
  readonly round: readonly number[];
}

/**
 * Lay the tree out round a circle, its root at the centre: each leaf a slot in the order the
 * tree lists them, with a gap where the colour changes so each colour group is a fan of its
 * own, and an opening of `opening` radians at the top where the time scale reads. A group sits
 * in the middle of its members.
 */
export function fanLayout(
  lineages: Lineages,
  colour: readonly number[],
  opening = 0.5,
  gap = 0.012,
): Fan {
  const count = lineages.nodes.length;
  const leaves: number[] = [];
  // Depth first, children in the order listed (oldest first).
  const stack = [0];
  while (stack.length > 0) {
    const at = stack.pop() ?? 0;
    const { children } = elementAt(lineages.nodes, at);
    if (children.length === 0) leaves.push(at);
    for (let child = children.length - 1; child >= 0; child--) stack.push(valueAt(children, child));
  }
  const breaks = leaves.filter(
    (leaf, at) => at > 0 && valueAt(colour, leaf) !== valueAt(colour, valueAt(leaves, at - 1)),
  ).length;
  const room = 2 * Math.PI - opening - breaks * gap;
  const step = leaves.length > 1 ? room / (leaves.length - 1) : 0;
  const angle = new Array<number>(count).fill(0);
  const low = new Array<number>(count).fill(Infinity);
  const high = new Array<number>(count).fill(-Infinity);
  let turn = -Math.PI / 2 + opening / 2;
  leaves.forEach((leaf, at) => {
    if (at > 0) {
      turn += step;
      if (valueAt(colour, leaf) !== valueAt(colour, valueAt(leaves, at - 1))) turn += gap;
    }
    angle[leaf] = turn;
    low[leaf] = turn;
    high[leaf] = turn;
  });
  // Children come after parents: settle groups from the end.
  for (let index = count - 1; index >= 0; index--) {
    const node = elementAt(lineages.nodes, index);
    if (node.children.length > 0) {
      for (const child of node.children) {
        low[index] = Math.min(valueAt(low, index), valueAt(low, child));
        high[index] = Math.max(valueAt(high, index), valueAt(high, child));
      }
      angle[index] = (valueAt(low, index) + valueAt(high, index)) / 2;
    }
  }
  const round = leaves.filter((leaf) => isGenus(elementAt(lineages.nodes, leaf)));
  return { angle, low, high, round };
}

/**
 * Colour groups: the group's members split, largest first, until there are up to `most` of
 * them. Groups with fewer than `least` of the genera (a share) are left uncoloured. Each node's
 * colour is the index of the group it is in, -1 above them or in a small one.
 */
export function colourGroups(
  lineages: Lineages,
  most = 8,
  least = 0.02,
): { readonly heads: readonly number[]; readonly colour: readonly number[] } {
  const genera = new Array<number>(lineages.nodes.length).fill(0);
  for (let index = lineages.nodes.length - 1; index >= 0; index--) {
    const node = elementAt(lineages.nodes, index);
    if (isGenus(node)) genera[index] = (genera[index] ?? 0) + 1;
    if (node.parent >= 0) genera[node.parent] = (genera[node.parent] ?? 0) + (genera[index] ?? 0);
  }
  // A head with one member is that member: open single lines until they branch.
  const opened = (head: number): number => {
    let at = head;
    for (;;) {
      const only = elementAt(lineages.nodes, at).children;
      if (only.length !== 1) return at;
      at = elementAt(only, 0);
    }
  };
  const total = valueAt(genera, 0);
  const big = (node: number): boolean => valueAt(genera, node) >= least * total;
  const bySize = (a: number, b: number): number => valueAt(genera, b) - valueAt(genera, a);
  let heads = [opened(0)];
  const whole = new Set<number>();
  for (;;) {
    const largest = heads.filter((head) => !whole.has(head)).sort(bySize)[0];
    if (largest === undefined) break;
    // Its members big enough to colour; the small ones stay uncoloured.
    const members = elementAt(lineages.nodes, largest)
      .children.map(opened)
      .filter(big)
      .sort(bySize);
    const [only] = members;
    if (members.length === 1 && only !== undefined) {
      // One big member and small ones: the big one takes its place.
      heads = heads.map((head) => (head === largest ? only : head));
      continue;
    }
    if (members.length === 0) {
      whole.add(largest);
      continue;
    }
    const room = most - heads.length + 1;
    if (room < 2) break;
    heads = [...heads.filter((head) => head !== largest), ...members.slice(0, room)];
    if (members.length > room) break;
  }
  heads.sort(bySize);
  const colour = new Array<number>(lineages.nodes.length).fill(-1);
  heads.forEach((head, at) => {
    colour[head] = at;
  });
  const isHead = new Set(heads);
  for (const node of lineages.nodes) {
    if (!isHead.has(node.index) && node.parent >= 0) {
      colour[node.index] = valueAt(colour, node.parent);
    }
  }
  return { heads, colour };
}

/** The node's line of ancestors, from the group down to it. */
export function ancestry(lineages: Lineages, index: number): readonly Lineage[] {
  const line: Lineage[] = [];
  for (let at = index; at >= 0; at = elementAt(lineages.nodes, at).parent) {
    line.unshift(elementAt(lineages.nodes, at));
  }
  return line;
}

/** Whether `index` is `ancestor` or below it. */
export function isWithin(lineages: Lineages, index: number, ancestor: number): boolean {
  for (let at = index; at >= 0; at = elementAt(lineages.nodes, at).parent) {
    if (at === ancestor) return true;
  }
  return false;
}
