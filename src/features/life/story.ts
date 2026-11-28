/**
 * An animal's story: a lineage's finds read as a story through time, place and climate. From a
 * group's file (`data/lifeStories`) and a lineage in it, what each 5-million-year step holds:
 * where its kinds were found, how many kinds there were, which began and which ended, and how
 * warm it was where they lay beside the globe's mean. The moments worth stopping at are
 * `chapters`', what to mark on the globe `marks`'.
 *
 * Everything here is of finds, not of ranges: a kind "found in Africa" was found there, and a
 * step with no finds is a gap in the record, not an absence.
 */

import type { LifeData, LifeNode, LifeSite } from '../../data/lifeStories';
import { elementAt } from '../../util/arrays';
import { chaptersOf, type Chapter } from './chapters';

export interface StoryStep {
  readonly ma: number;
  readonly finds: number;
  /** Finds in each part of today's world, as the group's `regions` lists them. */
  readonly byRegion: readonly number[];
  /** The kinds (genera) known then: found by then, and found again later or living. */
  readonly kinds: number;
  /** The kinds first found in this step, most finds first. */
  readonly began: readonly LifeNode[];
  /** The kinds last found in this step, and not living. */
  readonly ended: readonly LifeNode[];
  /** How warm it was where they were found, °C, each find counted; null with no finds. */
  readonly celsius: number | null;
  /** The globe's mean then, °C; null where there is no map. */
  readonly globe: number | null;
}

/** A kind in a story: its node, the steps of its first and last finds, and its sites by step. */
export interface Kind {
  readonly node: LifeNode;
  readonly first: number;
  /** Its last finds' step; 0 while it lives. */
  readonly last: number;
  readonly at: ReadonlyMap<number, readonly LifeSite[]>;
}

export interface Story {
  readonly data: LifeData;
  /** The lineage the story is of. */
  readonly clade: LifeNode;
  /** The kind picked out in it, if one was asked for. */
  readonly focus: LifeNode | null;
  /** The clade's ancestors, from the group down to it. */
  readonly ancestry: readonly LifeNode[];
  /** Its steps, oldest first. */
  readonly steps: readonly StoryStep[];
  readonly chapters: readonly Chapter[];
  readonly kinds: number;
  readonly living: number;
  readonly members: readonly Kind[];
}

/** The genera within a node, itself included. */
export function generaWithin(data: LifeData, index: number): LifeNode[] {
  const out: LifeNode[] = [];
  const stack = [index];
  for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
    const node = elementAt(data.nodes, at);
    if (node.sites.length > 0) out.push(node);
    stack.push(...node.children);
  }
  return out;
}

function kindOf(node: LifeNode): Kind {
  const at = new Map<number, LifeSite[]>();
  for (const site of node.sites) at.set(site.ma, [...(at.get(site.ma) ?? []), site]);
  const steps = [...at.keys()];
  return { node, first: Math.max(...steps), last: node.living ? 0 : Math.min(...steps), at };
}

/** What one kind adds to a step: its finds there, by region, and how warm they lay. */
function tally(
  kind: Kind,
  ma: number,
  byRegion: number[],
): { finds: number; warmth: number; measured: number } {
  let [finds, warmth, measured] = [0, 0, 0];
  for (const site of kind.at.get(ma) ?? []) {
    finds += site.finds;
    byRegion[site.region] = (byRegion[site.region] ?? 0) + site.finds;
    if (site.celsius !== null) {
      warmth += site.celsius * site.finds;
      measured += site.finds;
    }
  }
  return { finds, warmth, measured };
}

function stepOf(data: LifeData, members: readonly Kind[], ma: number): StoryStep {
  const byRegion = data.regions.map(() => 0);
  let [finds, warmth, measured] = [0, 0, 0];
  const began: { node: LifeNode; finds: number }[] = [];
  const ended: LifeNode[] = [];
  for (const kind of members) {
    const own = tally(kind, ma, byRegion);
    finds += own.finds;
    warmth += own.warmth;
    measured += own.measured;
    if (kind.first === ma) began.push({ node: kind.node, finds: own.finds });
    if (kind.last === ma && !kind.node.living) ended.push(kind.node);
  }
  return {
    ma,
    finds,
    byRegion,
    kinds: members.filter((kind) => ma <= kind.first && ma >= kind.last).length,
    began: began.sort((a, b) => b.finds - a.finds).map((each) => each.node),
    ended,
    celsius: measured === 0 ? null : warmth / measured,
    globe: data.globe.get(ma) ?? null,
  };
}

function stepsOf(data: LifeData, members: readonly Kind[]): StoryStep[] {
  const oldest = Math.max(...members.map((kind) => kind.first));
  const youngest = Math.min(...members.map((kind) => kind.last));
  const steps: StoryStep[] = [];
  for (let ma = oldest; ma >= youngest; ma -= data.stepMa) steps.push(stepOf(data, members, ma));
  return steps;
}

/**
 * The story of the node numbered `pbdb` in a group's file, with the kind numbered `focus`
 * picked out; null if the file has no such node, or it has no finds.
 */
export function storyOf(data: LifeData, pbdb: number, focus: number | null): Story | null {
  const clade = data.nodes.find((node) => node.pbdb === pbdb);
  if (clade === undefined) return null;
  const members = generaWithin(data, clade.index).map(kindOf);
  if (members.length === 0) return null;
  const picked = members.find((kind) => kind.node.pbdb === focus) ?? null;
  const ancestry: LifeNode[] = [];
  for (let at = clade.index; at >= 0; at = elementAt(data.nodes, at).parent) {
    ancestry.unshift(elementAt(data.nodes, at));
  }
  const steps = stepsOf(data, members);
  return {
    data,
    clade,
    focus: picked?.node ?? null,
    ancestry,
    steps,
    chapters: chaptersOf({ data, clade, focus: picked, members, steps }),
    kinds: members.length,
    living: members.filter((kind) => kind.node.living).length,
    members,
  };
}

/** The step a moment falls in: the nearest map's age. */
export function stepAt(story: Story, ma: number): number {
  return Math.round(ma / story.data.stepMa) * story.data.stepMa;
}

/** The lineages within the story's, with the most kinds first: the ways further in. */
export function branches(
  story: Story,
  most = 10,
): readonly { readonly node: LifeNode; readonly kinds: number }[] {
  return story.clade.children
    .map((child) => ({
      node: elementAt(story.data.nodes, child),
      kinds: generaWithin(story.data, child).length,
    }))
    .filter((each) => each.kinds > 0)
    .sort((a, b) => b.kinds - a.kinds)
    .slice(0, most);
}
