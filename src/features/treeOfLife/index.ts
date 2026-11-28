/**
 * The tree of life (#300) and life through time (#358), as a part of the page (#443): their two
 * sheets, each loaded the first time it is asked for, data and code alike (#220), and the ways
 * other parts open them at a taxon or at a genus.
 */

import {
  isGenus,
  loadLineages,
  type LineageGroup,
  type Lineages,
  type Place,
} from '../../data/lineages';
import { oldestFinds } from '../../data/fossilFinds';
import type { FossilFinds, LineagesView, TreeView } from '../../state/viewState';
import { loadTreeOfLife, type TreeOfLife } from '../../data/treeOfLife';
import { lazySheet, type LazySheet } from '../../ui/lazySheet';
import { errorMessage } from '../../util/errors';
import type { MountedPart, PartContext } from '../part';

/** Finds a node of the tree, or none for the whole tree. */
type TreePick = (tree: TreeOfLife) => number | undefined;

export interface TreeOfLifePart extends MountedPart {
  /** Open the tree at the node `pick` finds in it, or the whole tree when it finds none. */
  readonly openTreeAt: (pick: TreePick) => void;
  /** Open a group's lines with a genus picked out by name, or the group if it has none such. */
  readonly openLineagesAt: (group: LineageGroup, genus: string) => void;
}

/** The ways to a genus from the sheets (#309): its finds on the globe, or its line through time. */
function genusWays(
  context: PartContext,
  loadGroupLineages: (group: LineageGroup) => Promise<Lineages>,
): {
  readonly goToFinds: (ma: number, where: Place, finds: FossilFinds) => void;
  readonly openFindsAt: (group: LineageGroup, genus: string) => void;
  readonly openLineagesAt: (group: LineageGroup, genus: string) => void;
} {
  const { store } = context;

  /** Deep time at a moment, facing a place, with the fossils on and these finds ringed (#309). */
  function goToFinds(ma: number, where: Place, finds: FossilFinds): void {
    context.goToDeepTime(ma, 'fossils', where);
    store.set((state) => ({ ...state, finds }));
  }

  /** A genus's finds on the globe, from its first appearance, the tree of life closed (#309). */
  function openFindsAt(group: LineageGroup, genus: string): void {
    loadGroupLineages(group).then(
      (lineages) => {
        const node = lineages.nodes.find((each) => each.name === genus && isGenus(each));
        const start = node === undefined ? null : oldestFinds(node.track);
        if (node === undefined || start === null) {
          context.notify(`${genus} has no placed finds in the lines through time.`);
          return;
        }
        store.set((state) => ({ ...state, tree: null }));
        goToFinds(start.ma, start, { group, pbdb: node.pbdb });
      },
      (error: unknown) => {
        context.notify(`Could not load the genera’s finds: ${errorMessage(error)}`);
      },
    );
  }

  function openLineagesAt(group: LineageGroup, genus: string): void {
    loadGroupLineages(group).then(
      (lineages) => {
        const pick = lineages.nodes.find((node) => node.name === genus)?.pbdb ?? null;
        store.set((state) => ({ ...state, tree: null, lineages: { group, pick } }));
      },
      (error: unknown) => {
        context.notify(`Could not load the lines through time: ${errorMessage(error)}`);
      },
    );
  }

  return { goToFinds, openFindsAt, openLineagesAt };
}

/** Life through time's sheet, its code loaded the first time it shows (#220). */
function lazyLineagesSheet(
  context: PartContext,
  loadGroupLineages: (group: LineageGroup) => Promise<Lineages>,
  goToFinds: (ma: number, where: Place, finds: FossilFinds) => void,
  failed: (error: unknown) => void,
): LazySheet<LineagesView> {
  const { base, store } = context;
  return lazySheet<LineagesView>(
    () =>
      import('./lineagesSheet').then(({ createLineagesSheet }) =>
        createLineagesSheet(
          (lineages) => {
            store.set((state) => ({ ...state, lineages }));
          },
          loadGroupLineages,
          (ma) => `${base}data/paleodem/${String(ma)}.png`,
          (ma, where, finds) => {
            store.set((state) => ({ ...state, lineages: null }));
            goToFinds(ma, where, finds);
          },
          context.why('lineages', 'Life through time'),
        ),
      ),
    failed,
  );
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
  const { goToFinds, openFindsAt, openLineagesAt } = genusWays(context, loadGroupLineages);
  const failed = (error: unknown): void => {
    context.notify(`Could not load the sheet: ${errorMessage(error)}`);
  };
  const treeSheet = lazySheet<TreeView>(
    () =>
      import('./treeSheet').then(({ createTreeSheet }) =>
        createTreeSheet(
          (tree) => {
            store.set((state) => ({ ...state, tree }));
          },
          loadTree,
          context.why('tree', 'Tree of life'),
          (to, group, genus) => {
            if (to === 'time') openLineagesAt(group, genus);
            else openFindsAt(group, genus);
          },
        ),
      ),
    failed,
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

  const lineagesSheet = lazyLineagesSheet(context, loadGroupLineages, goToFinds, failed);

  return {
    watches: (state) => [state.tree, state.lineages],
    elements: [treeSheet.element, lineagesSheet.element],
    render(state) {
      treeSheet.show(state.tree);
      lineagesSheet.show(state.lineages);
    },
    openTreeAt,
    openLineagesAt,
  };
}
