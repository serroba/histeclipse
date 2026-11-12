/**
 * The tree of life, trimmed to what the site shows (`public/data/tree-of-life.json`, #279):
 * Open Tree of Life's synthetic tree and taxonomy (CC0), written by the pipeline's
 * `tree-of-life` command. The backbone down to orders, the fossil genera and their groups, and
 * our species with Neanderthals and Denisovans, joined by their ancestors. Nodes are columns,
 * each after its parent; each says whether it is extinct, whether published phylogenies
 * support it, and whether only the taxonomy places it. How the site uses it is still open.
 */

import * as v from 'valibot';

import { valueAt } from '../util/arrays';
import { getJson, type Fetch } from '../util/fetchJson';

const Index = v.pipe(v.number(), v.integer(), v.minValue(0));
const IndexMap = v.record(v.string(), Index);

const TreeOfLifeSchema = v.pipe(
  v.strictObject({
    schemaVersion: v.literal(1),
    accessed: v.pipe(v.string(), v.regex(/^\d{4}-\d{2}-\d{2}$/)),
    credit: v.pipe(v.string(), v.minLength(1)),
    source: v.pipe(v.string(), v.url()),
    synthesis: v.string(),
    taxonomy: v.string(),
    flags: v.strictObject({
      extinct: v.literal(1),
      phylogeny: v.literal(2),
      taxonomyOnly: v.literal(4),
    }),
    ranks: v.array(v.string()),
    ott: v.array(v.pipe(v.number(), v.integer(), v.minValue(0))),
    name: v.array(v.string()),
    rank: v.array(Index),
    parent: v.array(v.pipe(v.number(), v.integer(), v.minValue(-1))),
    nodeFlags: v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(7))),
    ours: v.strictObject({ fossilGenera: IndexMap, fossilGroups: IndexMap, humans: IndexMap }),
    unmatched: v.strictObject({ ambiguous: v.array(v.string()), missing: v.array(v.string()) }),
  }),
  v.check(
    (tree) =>
      [tree.ott, tree.name, tree.rank, tree.nodeFlags].every(
        (column) => column.length === tree.parent.length,
      ),
    'every column has a value for each node',
  ),
  v.check(
    (tree) =>
      tree.parent.every((parent, i) => (i === 0 ? parent === -1 : parent >= 0 && parent < i)),
    'one root, and each node after its parent',
  ),
  v.check((tree) => tree.rank.every((rank) => rank < tree.ranks.length), 'every rank is listed'),
  v.check(
    (tree) =>
      [tree.ours.fossilGenera, tree.ours.fossilGroups, tree.ours.humans].every((map) =>
        Object.values(map).every((index) => index < tree.parent.length),
      ),
    'the site’s taxa are nodes of the tree',
  ),
);

export type TreeOfLife = v.InferOutput<typeof TreeOfLifeSchema>;

export async function loadTreeOfLife(url: string, fetchJson: Fetch): Promise<TreeOfLife> {
  return getJson(fetchJson, url, TreeOfLifeSchema);
}

/** A node's line back to the root, the node first. */
export function lineage(tree: TreeOfLife, node: number): readonly number[] {
  const line: number[] = [];
  for (let at = node; at !== -1; at = valueAt(tree.parent, at)) line.push(at);
  return line;
}

/** A node's named groups, nearest first, as a reader would list them. */
export function namedLineage(tree: TreeOfLife, node: number): readonly string[] {
  return lineage(tree, node)
    .map((at) => tree.name[at] ?? '')
    .filter((name) => name !== '');
}

/** Whether a node has one of the file's flags. */
export function hasFlag(tree: TreeOfLife, node: number, flag: keyof TreeOfLife['flags']): boolean {
  return (valueAt(tree.nodeFlags, node) & tree.flags[flag]) !== 0;
}
