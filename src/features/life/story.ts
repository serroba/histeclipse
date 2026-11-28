/**
 * An animal's story (a prototype): a lineage's finds read as a story through time, place and
 * climate. From a group's file (`data/lifeStories`) and a lineage in it, what each 5-million-year
 * step holds (where its kinds were found, how many kinds there were, which began and which
 * ended, how warm it was where they lay beside the globe's mean), the moments worth stopping at,
 * and what to mark on the globe at a moment.
 *
 * Everything here is of finds, not of ranges: a kind "found in Africa" was found there, and a
 * step with no finds is a gap in the record, not an absence.
 */

import type { LifeData, LifeNode, LifeSite } from '../../data/lifeStories';
import { elementAt } from '../../util/arrays';

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

/** A moment of the story worth stopping at. */
export interface Chapter {
  readonly ma: number;
  readonly title: string;
  readonly text: string;
  /** Where to turn the globe to, where it lay then. */
  readonly where: { readonly latitude: number; readonly longitude: number } | null;
}

interface Kind {
  readonly node: LifeNode;
  readonly first: number;
  readonly last: number;
  /** Its sites by step. */
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
  /** The kinds in it, for the marks. */
  readonly members: readonly Kind[];
}

/** The genera within a node, itself included. */
function generaWithin(data: LifeData, index: number): LifeNode[] {
  const out: LifeNode[] = [];
  const stack = [index];
  while (stack.length > 0) {
    const node = elementAt(data.nodes, stack.pop() ?? 0);
    if (node.sites.length > 0) out.push(node);
    stack.push(...node.children);
  }
  return out;
}

function kindOf(node: LifeNode): Kind {
  const at = new Map<number, LifeSite[]>();
  let first = -Infinity;
  let last = Infinity;
  for (const site of node.sites) {
    const sites = at.get(site.ma);
    if (sites === undefined) at.set(site.ma, [site]);
    else sites.push(site);
    first = Math.max(first, site.ma);
    last = Math.min(last, site.ma);
  }
  return { node, first, last: node.living ? 0 : last, at };
}

/** A lineage's name as a reader knows it: its common name where PBDB has one, else its own. */
export function plainName(node: LifeNode): string {
  return node.common === '' ? node.name : node.common;
}

/** "North America", "North America and Asia", "North America, Asia and Africa". */
export function listed(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

function degrees(celsius: number): string {
  return `${String(Math.round(celsius))} °C`;
}

function ago(ma: number): string {
  return ma === 0 ? 'In the last 2.5 million years' : `${String(ma)} million years ago`;
}

/** Up to three kinds by name, and how many more. */
function named(nodes: readonly LifeNode[]): string {
  const shown = nodes.slice(0, 3).map((node) => node.name);
  const more = nodes.length - shown.length;
  return more > 0 ? `${shown.join(', ')} and ${String(more)} more` : listed(shown);
}

function stepsOf(data: LifeData, members: readonly Kind[]): StoryStep[] {
  if (members.length === 0) return [];
  const oldest = Math.max(...members.map((kind) => kind.first));
  const youngest = Math.min(...members.map((kind) => kind.last));
  const steps: StoryStep[] = [];
  for (let ma = oldest; ma >= youngest; ma -= data.stepMa) {
    const byRegion = data.regions.map(() => 0);
    let finds = 0;
    let warmth = 0;
    let measured = 0;
    let kinds = 0;
    const began: { node: LifeNode; finds: number }[] = [];
    const ended: LifeNode[] = [];
    for (const kind of members) {
      if (ma <= kind.first && ma >= kind.last) kinds++;
      const sites = kind.at.get(ma);
      if (sites === undefined) continue;
      let own = 0;
      for (const site of sites) {
        own += site.finds;
        byRegion[site.region] = (byRegion[site.region] ?? 0) + site.finds;
        if (site.celsius !== null) {
          warmth += site.celsius * site.finds;
          measured += site.finds;
        }
      }
      finds += own;
      if (kind.first === ma) began.push({ node: kind.node, finds: own });
      if (kind.last === ma && !kind.node.living) ended.push(kind.node);
    }
    began.sort((a, b) => b.finds - a.finds);
    steps.push({
      ma,
      finds,
      byRegion,
      kinds,
      began: began.map((each) => each.node),
      ended,
      celsius: measured === 0 ? null : warmth / measured,
      globe: data.globe.get(ma) ?? null,
    });
  }
  return steps;
}

/** The site with the most finds in a step, of these kinds, in a region if one is named. */
function mainSite(members: readonly Kind[], ma: number, region: number | null): LifeSite | null {
  let best: LifeSite | null = null;
  for (const kind of members) {
    for (const site of kind.at.get(ma) ?? []) {
      if (region !== null && site.region !== region) continue;
      if (best === null || site.finds > best.finds) best = site;
    }
  }
  return best;
}

function climateSaid(step: StoryStep): string {
  if (step.celsius === null || step.globe === null) return '';
  return ` Where they lay it was about ${degrees(step.celsius)}; the globe averaged ${degrees(step.globe)}.`;
}

function chaptersOf(
  data: LifeData,
  clade: LifeNode,
  focus: Kind | null,
  members: readonly Kind[],
  steps: readonly StoryStep[],
): Chapter[] {
  const chapters: Chapter[] = [];
  const [origin] = steps;
  if (origin === undefined) return chapters;
  const who = plainName(clade);
  const regionsOf = (step: StoryStep): string[] =>
    data.regions.filter((_, region) => (step.byRegion[region] ?? 0) > 0);
  chapters.push({
    ma: origin.ma,
    title: 'The oldest finds',
    text: `${ago(origin.ma)}: ${named(origin.began)}, in ${listed(regionsOf(origin))}.${climateSaid(origin)}`,
    where: mainSite(members, origin.ma, null),
  });

  // Each part of the world, the first time it has finds.
  const reached = new Set<number>(
    origin.byRegion.flatMap((count, region) => (count > 0 ? [region] : [])),
  );
  for (const step of steps.slice(1)) {
    const fresh = step.byRegion.flatMap((count, region) =>
      count > 0 && !reached.has(region) ? [region] : [],
    );
    if (fresh.length === 0) continue;
    for (const region of fresh) reached.add(region);
    const waited = origin.ma - step.ma;
    const first = elementAt(fresh, 0);
    chapters.push({
      ma: step.ma,
      title: `First found in ${listed(fresh.map((region) => elementAt(data.regions, region)))}`,
      text: `${ago(step.ma)}, ${String(waited)} million years after the oldest finds.${climateSaid(step)}`,
      where: mainSite(members, step.ma, first),
    });
  }

  // Where the world cooled round them, or they stayed in the warmth: the widest gap.
  let widest: StoryStep | null = null;
  for (const step of steps) {
    if (step.celsius === null || step.globe === null || step.finds < 5) continue;
    const gap = Math.abs(step.celsius - step.globe);
    const best =
      widest === null || widest.celsius === null || widest.globe === null
        ? -1
        : Math.abs(widest.celsius - widest.globe);
    if (gap > best) widest = step;
  }
  if (widest !== null && widest.celsius !== null && widest.globe !== null) {
    const gap = widest.celsius - widest.globe;
    if (Math.abs(gap) >= 4) {
      chapters.push({
        ma: widest.ma,
        title: gap > 0 ? 'Keeping to the warmth' : 'Living in the cold',
        text: `${ago(widest.ma)} the globe averaged ${degrees(widest.globe)}; where the ${who} finds lay it was about ${degrees(widest.celsius)}.`,
        where: mainSite(members, widest.ma, null),
      });
    }
  }

  // The most kinds at once.
  const peak = steps.reduce((best, step) => (step.kinds > best.kinds ? step : best), origin);
  if (peak.kinds > 1 && peak !== origin) {
    chapters.push({
      ma: peak.ma,
      title: 'The most kinds at once',
      text: `${ago(peak.ma)}: ${String(peak.kinds)} kinds known, found in ${listed(regionsOf(peak))}.`,
      where: mainSite(members, peak.ma, null),
    });
  }

  // The step that ends the most kinds, where it is not the story's own end.
  const worst = steps.reduce((best, step) => (step.ended.length > best.ended.length ? step : best));
  if (worst.ended.length >= 3) {
    chapters.push({
      ma: worst.ma,
      title: 'The most endings',
      text: `${ago(worst.ma)}: the last finds of ${String(worst.ended.length)} kinds, ${named(worst.ended)} among them.`,
      where: mainSite(members, worst.ma, null),
    });
  }

  if (focus !== null && focus.first !== origin.ma) {
    const step = steps.find((each) => each.ma === focus.first);
    chapters.push({
      ma: focus.first,
      title: `The oldest ${focus.node.name} finds`,
      text: `${ago(focus.first)}, in ${listed(
        [...new Set((focus.at.get(focus.first) ?? []).map((site) => site.region))].map((region) =>
          elementAt(data.regions, region),
        ),
      )}.${step === undefined ? '' : climateSaid(step)}`,
      where: focus.at.get(focus.first)?.[0] ?? null,
    });
  }

  const end = elementAt(steps, steps.length - 1);
  const living = members.filter((kind) => kind.node.living);
  chapters.push(
    living.length > 0
      ? {
          ma: 0,
          title: 'Today',
          text: `${String(living.length)} of its ${String(members.length)} kinds found as fossils ${living.length === 1 ? 'is' : 'are'} living: ${named(living.map((kind) => kind.node))}.`,
          where: mainSite(members, 0, null),
        }
      : {
          ma: end.ma,
          title: 'The last finds',
          text: `${ago(end.ma)}: ${named(end.ended)}, in ${listed(regionsOf(end))}. None of its ${String(members.length)} kinds is living.`,
          where: mainSite(members, end.ma, null),
        },
  );
  return chapters.sort((a, b) => b.ma - a.ma);
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
  const picked = focus === null ? undefined : members.find((kind) => kind.node.pbdb === focus);
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
    chapters: chaptersOf(data, clade, picked ?? null, members, steps),
    kinds: members.length,
    living: members.filter((kind) => kind.node.living).length,
    members,
  };
}

/** The step a moment falls in: the nearest map's age. */
export function stepAt(story: Story, ma: number): number {
  return Math.round(ma / story.data.stepMa) * story.data.stepMa;
}

export type MarkKind = 'focus' | 'began' | 'found' | 'ended';

/** A site to mark on the globe at a moment. */
export interface Mark {
  readonly latitude: number;
  readonly longitude: number;
  readonly finds: number;
  readonly kind: MarkKind;
  /** Whether this is the kind's site with the most finds in the step: the one its picture points at. */
  readonly lead: boolean;
  readonly title: string;
  /** The kind found here, and the site itself. */
  readonly node: LifeNode;
  readonly site: LifeSite;
}

const MARK_ORDER: Readonly<Record<MarkKind, number>> = { focus: 0, began: 1, ended: 2, found: 3 };

/**
 * What to mark at a moment: each site of the step, the picked kind's and the newly found kinds'
 * told apart; and, a step after a kind's last finds, where it was last seen. The `most` sites
 * with the most to say.
 */
export function marksAt(story: Story, ma: number, most = 220): readonly Mark[] {
  const step = stepAt(story, ma);
  const marks: Mark[] = [];
  for (const kind of story.members) {
    const isFocus = story.focus !== null && kind.node.index === story.focus.index;
    // In the last step, a kind that is not living is one lost since.
    const lost = step === 0 && kind.last === 0 && !kind.node.living;
    const state: MarkKind = lost
      ? 'ended'
      : isFocus
        ? 'focus'
        : kind.first === step
          ? 'began'
          : 'found';
    (kind.at.get(step) ?? []).forEach((site, at) => {
      marks.push({
        latitude: site.latitude,
        longitude: site.longitude,
        finds: site.finds,
        kind: state,
        lead: at === 0,
        node: kind.node,
        site,
        title: `${kind.node.name}: ${String(site.finds)} ${site.finds === 1 ? 'find' : 'finds'}${
          state === 'began' ? ', its oldest' : lost ? ', among its last' : ''
        }`,
      });
    });
    // A step on from its last finds: where it was last seen.
    if (!kind.node.living && kind.last === step + story.data.stepMa) {
      (kind.at.get(kind.last) ?? []).forEach((site, at) => {
        marks.push({
          latitude: site.latitude,
          longitude: site.longitude,
          finds: site.finds,
          kind: 'ended',
          lead: at === 0,
          node: kind.node,
          site,
          title: `${kind.node.name}: last found here, ${String(kind.last)} million years ago`,
        });
      });
    }
  }
  marks.sort((a, b) => MARK_ORDER[a.kind] - MARK_ORDER[b.kind] || b.finds - a.finds);
  return marks.slice(0, most);
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
