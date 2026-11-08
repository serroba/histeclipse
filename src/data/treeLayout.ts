/**
 * Where each node of the tree of life sits in its 3D view (#300): a radial tree on a disc, the
 * root at the centre and each level further out, every clade a wedge as wide as its share of the
 * tips. Pure, so the sheet that draws it (`ui/treeSheet.ts`) only has to place what this says.
 */

import { elementAt, valueAt } from '../util/arrays';
import type { TreeOfLife } from './treeOfLife';

/**
 * The groups the view colours, each node taking the nearest it lies in. The site's own taxa
 * (trilobites, ammonoids, dinosaurs, mammals, Homo) and the large branches around them.
 */
export const TREE_CLADES = [
  'Bacteria',
  'Archaea',
  'Fungi',
  'Chloroplastida',
  'SAR',
  'Cnidaria',
  'Mollusca',
  'Ammonoidea',
  'Brachiopoda',
  'Echinodermata',
  'Arthropoda',
  'Trilobita',
  'Insecta',
  'Actinopterygii',
  'Sauropsida',
  'Dinosauria',
  'Aves',
  'Mammalia',
  'Homo',
] as const;

export type TreeClade = (typeof TREE_CLADES)[number] | 'other';

export interface TreeLayout {
  /** Each node's place on the disc: `x` and `z` in -1..1, the root at 0. */
  readonly x: Float64Array;
  readonly z: Float64Array;
  /** Steps from the root. */
  readonly depth: Uint16Array;
  /** How many tips (nodes without children) the node holds, itself if it is one. */
  readonly tips: Uint32Array;
  readonly clade: readonly TreeClade[];
  readonly maxDepth: number;
}

/** The innermost ring, so the first levels do not crowd the centre. */
const INNER = 0.12;

export function treeLayout(tree: TreeOfLife): TreeLayout {
  const n = tree.parent.length;
  const children: number[][] = Array.from({ length: n }, () => []);
  for (let node = 1; node < n; node++) elementAt(children, valueAt(tree.parent, node)).push(node);

  // The file lists each node after its parent, so one pass forward gives depths and clades,
  // and one pass back the tip counts.
  const depth = new Uint16Array(n);
  const clade: TreeClade[] = new Array<TreeClade>(n).fill('other');
  const named = new Set<string>(TREE_CLADES);
  for (let node = 0; node < n; node++) {
    const parent = valueAt(tree.parent, node);
    const name = elementAt(tree.name, node);
    depth[node] = parent === -1 ? 0 : valueAt(depth, parent) + 1;
    clade[node] = named.has(name)
      ? (name as TreeClade)
      : parent === -1
        ? 'other'
        : elementAt(clade, parent);
  }
  const tips = new Uint32Array(n);
  for (let node = n - 1; node >= 0; node--) {
    if (elementAt(children, node).length === 0) tips[node] = 1;
    const parent = valueAt(tree.parent, node);
    if (parent !== -1) tips[parent] = valueAt(tips, parent) + valueAt(tips, node);
  }
  let maxDepth = 0;
  for (const each of depth) maxDepth = Math.max(maxDepth, each);

  // Each node's wedge starts where its elder siblings' end; it sits at the wedge's middle.
  const total = valueAt(tips, 0);
  const start = new Float64Array(n);
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const stack = [0];
  while (stack.length > 0) {
    const node = stack.pop() ?? 0;
    let at = valueAt(start, node);
    for (const child of elementAt(children, node)) {
      start[child] = at;
      at += valueAt(tips, child);
      stack.push(child);
    }
    if (node === 0) continue;
    const angle = ((valueAt(start, node) + valueAt(tips, node) / 2) / total) * 2 * Math.PI;
    // The square root spreads the deep levels, where most nodes are, over more of the disc.
    const radius = INNER + (1 - INNER) * Math.sqrt(valueAt(depth, node) / Math.max(maxDepth, 1));
    x[node] = radius * Math.cos(angle);
    z[node] = radius * Math.sin(angle);
  }
  return { x, z, depth, tips, clade, maxDepth };
}

/** The node an Open Tree of Life id names, or null when the trimmed tree does not hold it. */
export function nodeOfOtt(tree: TreeOfLife, ott: number): number | null {
  const node = tree.ott.indexOf(ott);
  return node === -1 ? null : node;
}
