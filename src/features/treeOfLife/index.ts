/**
 * The tree of life (#300) and life through time (#358), as a part of the page (#443): their two
 * sheets, each loaded the first time it is asked for, and the ways other parts open them at a
 * taxon or at a genus.
 */

import { loadLineages, type LineageGroup, type Lineages } from '../../data/lineages';
import { loadTreeOfLife, type TreeOfLife } from '../../data/treeOfLife';
import { createLineagesSheet } from '../../ui/lineagesSheet';
import { createTreeSheet } from '../../ui/treeSheet';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';

/** Finds a node of the tree, or none for the whole tree. */
export type TreePick = (tree: TreeOfLife) => number | undefined;

/** A button's label and what it does, as cards and the Layers panel take them. */
export interface Action {
  readonly label: string;
  readonly run: () => void;
}

export interface TreeOfLifePart extends MountedPart {
  /** Open the tree at the node `pick` finds in it, or the whole tree when it finds none. */
  readonly openTreeAt: (pick: TreePick) => void;
  /** An action that opens the tree at the node `pick` finds. */
  readonly action: (label: string, pick: TreePick) => Action;
  /** Open a group's lines with a genus picked out by name, or the group if it has none such. */
  readonly openLineagesAt: (group: LineageGroup, genus: string) => void;
}

export function mountTreeOfLife(context: PartContext): TreeOfLifePart {
  const { base, fetchJson, store } = context;
  let treeOfLife: Promise<TreeOfLife> | null = null;
  const loadTree = (): Promise<TreeOfLife> => {
    treeOfLife ??= loadTreeOfLife(`${base}data/tree-of-life.json`, fetchJson);
    treeOfLife.catch(() => {
      treeOfLife = null;
    });
    return treeOfLife;
  };
  const treeSheet = createTreeSheet(
    (tree) => {
      store.set((state) => ({ ...state, tree }));
    },
    loadTree,
    context.why('tree', 'Tree of life'),
  );
  function openTreeAt(pick: TreePick): void {
    loadTree().then(
      (tree) => {
        const node = pick(tree);
        const ott = node === undefined ? undefined : tree.ott[node];
        store.set((state) => ({ ...state, tree: ott === undefined ? 'all' : { ott } }));
      },
      (error: unknown) => {
        context.notify(`Could not load the tree of life: ${errorMessage(error)}`);
      },
    );
  }

  // Each fossil group's genera, a file per group, loaded when shown.
  const lineagesLoading = new Map<LineageGroup, Promise<Lineages>>();
  const loadGroupLineages = (group: LineageGroup): Promise<Lineages> => {
    let loading = lineagesLoading.get(group);
    if (loading === undefined) {
      loading = loadLineages(`${base}data/time-tree/${group}.json`, fetchJson);
      loading.catch(() => lineagesLoading.delete(group));
      lineagesLoading.set(group, loading);
    }
    return loading;
  };
  const lineagesSheet = createLineagesSheet(
    (lineages) => {
      store.set((state) => ({ ...state, lineages }));
    },
    loadGroupLineages,
    (ma) => `${base}data/paleodem/${String(ma)}.png`,
    (ma, where) => {
      store.set((state) => ({ ...state, lineages: null }));
      context.goToDeepTime(ma, 'fossils', where);
    },
    context.why('lineages', 'Life through time'),
  );

  return {
    watches: (state) => [state.tree, state.lineages],
    elements: [treeSheet.dialog, lineagesSheet.dialog],
    render(state) {
      treeSheet.show(state.tree);
      lineagesSheet.show(state.lineages);
    },
    openTreeAt,
    action: (label, pick) => ({
      label,
      run: () => {
        openTreeAt(pick);
      },
    }),
    openLineagesAt: (group, genus) => {
      loadGroupLineages(group).then(
        (lineages) => {
          const pick = lineages.nodes.find((node) => node.name === genus)?.pbdb ?? null;
          store.set((state) => ({ ...state, lineages: { group, pick } }));
        },
        (error: unknown) => {
          context.notify(`Could not load the lines through time: ${errorMessage(error)}`);
        },
      );
    },
  };
}
