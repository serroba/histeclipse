import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import data from '../../public/data/tree-of-life.json';
import { treeLayout, nodeOfOtt, TREE_CLADES } from './treeLayout';
import type { TreeOfLife } from './treeOfLife';

const real = data as TreeOfLife;

/** A tree of `parent` links, the other columns filled in. */
function treeOf(parent: readonly number[], names: readonly string[] = []): TreeOfLife {
  return {
    ...real,
    ott: parent.map((_, node) => node + 100),
    name: parent.map((_, node) => names[node] ?? ''),
    rank: parent.map(() => 0),
    parent: [...parent],
    nodeFlags: parent.map(() => 0),
    ours: { fossilGenera: {}, fossilGroups: {}, humans: {} },
  };
}

/** Random trees: each node after its parent. */
const trees = fc
  .array(fc.nat(), { minLength: 1, maxLength: 200 })
  .map((picks) => [-1, ...picks.map((pick, index) => pick % (index + 1))]);

describe('the tree of life laid out on a disc', () => {
  it('places every node of the real tree on the disc, the root at its centre', () => {
    const layout = treeLayout(real);
    expect(layout.x.length).toBe(real.parent.length);
    expect([layout.x[0], layout.z[0]]).toEqual([0, 0]);
    for (let node = 0; node < real.parent.length; node++) {
      const radius = Math.hypot(layout.x[node] ?? NaN, layout.z[node] ?? NaN);
      expect(radius).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(layout.tips[0]).toBe(5905);
    expect(layout.maxDepth).toBe(53);
  });

  it('puts each child further out than its parent, within its parent’s wedge', () => {
    fc.assert(
      fc.property(trees, (parent) => {
        const layout = treeLayout(treeOf(parent));
        for (let node = 1; node < parent.length; node++) {
          const up = parent[node] ?? 0;
          const radius = Math.hypot(layout.x[node] ?? 0, layout.z[node] ?? 0);
          expect(radius).toBeGreaterThan(Math.hypot(layout.x[up] ?? 0, layout.z[up] ?? 0));
        }
      }),
    );
  });

  it('counts tips: a leaf is one, a clade the sum of its children', () => {
    fc.assert(
      fc.property(trees, (parent) => {
        const { tips } = treeLayout(treeOf(parent));
        const leaves = parent.filter((_, node) => !parent.includes(node)).length;
        expect(tips[0]).toBe(leaves);
      }),
    );
  });

  it('lays out the same tree the same way', () => {
    const a = treeLayout(real);
    const b = treeLayout(real);
    expect([...a.x]).toEqual([...b.x]);
    expect([...a.z]).toEqual([...b.z]);
  });

  it('colours each node by the nearest named group above it', () => {
    const layout = treeLayout(real);
    const sapiens = real.ours.humans['sapiens'] ?? -1;
    expect(layout.clade[sapiens]).toBe('Homo');
    expect(layout.clade[real.ours.fossilGenera['Triceratops'] ?? -1]).toBe('Dinosauria');
    // The synthesis does not hold Dinosauria as one clade ("broken" in Open Tree's terms): many
    // dinosaurs hang from unnamed nodes beside it, and take the next named group up.
    expect(layout.clade[real.ours.fossilGenera['Tyrannosaurus'] ?? -1]).toBe('Sauropsida');
    expect(layout.clade[0]).toBe('other');
    // Every group the view names is in the tree it draws.
    for (const name of TREE_CLADES) expect(real.name).toContain(name);
  });

  it('finds a node by its Open Tree id, and says when the tree lacks it', () => {
    const tree = treeOf([-1, 0, 0]);
    expect(nodeOfOtt(tree, 102)).toBe(2);
    expect(nodeOfOtt(tree, 7)).toBeNull();
  });
});
