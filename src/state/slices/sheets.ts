/**
 * The sheets a link can open (#381): the why, the tree of life, the impacts' paths, a fossil
 * group's lineages and the planetary boundaries' story. Each is left out of a link when closed.
 *
 * In a link:
 * - `why` is what the why panel explains, `all` for every source, or `here`.
 * - `tree` is `all`, or `ott` and an Open Tree of Life id (`ott770315`).
 * - `craters` is `all`, or an Impact Earth Database id; `cratersin` is `map` (absent) or `box`.
 * - `lineages` is a fossil group, then perhaps `:` and a PBDB number (`dinosaurs:38613`).
 * - `boundaries` is the boundaries' story's chapter.
 */

import { LINEAGE_GROUPS, type LineageGroup } from '../../data/lineages';
import { WHY_VIEWS, type WhyView } from '../../sources/registry';
import { choice, choiceOrNull, type Params } from '../slice';

/** What the lineages through time show: a fossil group, and one of its names picked out. */
export interface LineagesView {
  readonly group: LineageGroup;
  readonly pick: number | null;
}

export const CRATERS_SHAPES = ['map', 'box'] as const;
export type CratersShape = (typeof CRATERS_SHAPES)[number];

/** What the impacts' paths show: all of them, or one crater's picked out. */
export type CratersView = 'all' | { readonly id: number };

/** What the tree of life shows: all of it, or one taxon's place in it (its Open Tree id). */
export type TreeView = 'all' | { readonly ott: number };

/** The planetary boundaries' story's chapters (#434), in order; the Holocene's first (#453). */
export const BOUNDARY_CHAPTERS = ['holocene', 'safe', 'pressure', 'compare'] as const;
export type BoundaryChapter = (typeof BOUNDARY_CHAPTERS)[number];

export interface SheetsState {
  /** The why panel open: what it explains, or every source; null when closed. */
  readonly why: WhyView | null;
  /**
   * The tree of life open (#300): the whole tree, or the node an Open Tree of Life id names, its
   * line back to the root lit; null when closed.
   */
  readonly tree: TreeView | null;
  /**
   * The impacts' paths through time open (#304): all of them, or one crater's (its Impact Earth
   * Database id) picked out; null when closed.
   */
  readonly craters: CratersView | null;
  /** How the impacts' paths are drawn (#322): on a flat map, or in a 3D box with time as depth. */
  readonly cratersIn: CratersShape;
  /**
   * A fossil group's genera through time and place open (#358): the group, and the genus or
   * group within it picked out (its PBDB number); null when closed.
   */
  readonly lineages: LineagesView | null;
  /** The planetary boundaries' story open (#434), at a chapter; null when closed. */
  readonly boundaries: BoundaryChapter | null;
}

export const SHEETS_DEFAULTS: SheetsState = {
  why: null,
  tree: null,
  craters: null,
  cratersIn: 'map',
  lineages: null,
  boundaries: null,
};

export const SHEETS_PARAMS: Params<SheetsState> = {
  why: choiceOrNull('why', WHY_VIEWS),
  tree: {
    key: 'tree',
    parse: parseTree,
    format: (tree) => (tree === null ? null : tree === 'all' ? 'all' : `ott${String(tree.ott)}`),
  },
  craters: {
    key: 'craters',
    parse: parseCraters,
    format: (craters) => (craters === null ? null : craters === 'all' ? 'all' : String(craters.id)),
  },
  cratersIn: choice('cratersin', CRATERS_SHAPES, SHEETS_DEFAULTS.cratersIn),
  lineages: {
    key: 'lineages',
    parse: parseLineagesView,
    format: (view) =>
      view === null ? null : view.pick === null ? view.group : `${view.group}:${String(view.pick)}`,
  },
  boundaries: choiceOrNull('boundaries', BOUNDARY_CHAPTERS),
};

/** `tree=all`, or `tree=ott` and an Open Tree of Life id, as Open Tree writes them. */
function parseTree(raw: string): TreeView {
  if (raw === 'all') return 'all';
  const match = /^ott(\d{1,10})$/.exec(raw);
  if (match === null)
    throw new Error('expected all, or ott and an Open Tree id, such as ott770315');
  return { ott: Number(match[1]) };
}

/** `craters=all`, or `craters=` and an Impact Earth Database id. */
function parseCraters(raw: string): CratersView {
  if (raw === 'all') return 'all';
  if (!/^\d{1,6}$/.test(raw)) throw new Error('expected all, or a crater’s id, such as 12');
  return { id: Number(raw) };
}

/** `lineages=` and a fossil group, then `:` and a PBDB number to pick one of its names out. */
function parseLineagesView(raw: string): LineagesView {
  const [group, pick, ...rest] = raw.split(':');
  const known = LINEAGE_GROUPS.find((each) => each === group);
  if (known === undefined || rest.length > 0 || (pick !== undefined && !/^\d{1,7}$/.test(pick))) {
    throw new Error(
      `expected ${LINEAGE_GROUPS.join(', ')}, then perhaps : and a PBDB number, such as dinosaurs:38613`,
    );
  }
  return { group: known, pick: pick === undefined ? null : Number(pick) };
}
