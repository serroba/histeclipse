/**
 * The moments of an animal's story worth stopping at, found in its steps: its oldest finds,
 * each part of the world the first time it has finds, where it kept to the warmth (or the cold)
 * as the globe changed, its most kinds at once, its most endings, the picked kind's own oldest
 * finds, and how it stands today or where it ended.
 */

import type { LifeData, LifeNode, LifeSite } from '../../data/lifeStories';
import { elementAt } from '../../util/arrays';
import type { Kind, StoryStep } from './story';
import { listed, plainName } from './words';

/** A moment of the story worth stopping at. */
export interface Chapter {
  readonly ma: number;
  readonly title: string;
  readonly text: string;
  /** Where to turn the globe to, where it lay then. */
  readonly where: { readonly latitude: number; readonly longitude: number } | null;
}

/** What the moments are found in. */
interface Told {
  readonly data: LifeData;
  readonly clade: LifeNode;
  readonly focus: Kind | null;
  readonly members: readonly Kind[];
  readonly steps: readonly StoryStep[];
}

/** A gap this wide, °C, between where they lay and the globe's mean is worth a moment. */
const WIDE_GAP = 4;
/** A step is read for its warmth only with this many finds. */
const ENOUGH_FINDS = 5;
/** A step ending this many kinds is worth a moment. */
const MANY_ENDINGS = 3;

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

/** The site with the most finds in a step, of these kinds, in a region if one is named. */
function mainSite(members: readonly Kind[], ma: number, region: number | null): LifeSite | null {
  let best: LifeSite | null = null;
  for (const kind of members) {
    for (const site of kind.at.get(ma) ?? []) {
      const here = region === null || site.region === region;
      if (here && (best === null || site.finds > best.finds)) best = site;
    }
  }
  return best;
}

function climateSaid(step: StoryStep): string {
  if (step.celsius === null || step.globe === null) return '';
  return ` Where they lay it was about ${degrees(step.celsius)}; the globe averaged ${degrees(step.globe)}.`;
}

function regionsOf(data: LifeData, step: StoryStep): string[] {
  return data.regions.filter((_, region) => (step.byRegion[region] ?? 0) > 0);
}

function oldestFinds({ data, members }: Told, origin: StoryStep): Chapter {
  return {
    ma: origin.ma,
    title: 'The oldest finds',
    text: `${ago(origin.ma)}: ${named(origin.began)}, in ${listed(regionsOf(data, origin))}.${climateSaid(origin)}`,
    where: mainSite(members, origin.ma, null),
  };
}

/** Each part of the world, the first time it has finds after the oldest. */
function firstFound({ data, members, steps }: Told, origin: StoryStep): Chapter[] {
  const reached = new Set(origin.byRegion.flatMap((count, region) => (count > 0 ? [region] : [])));
  const out: Chapter[] = [];
  for (const step of steps.slice(1)) {
    const fresh = step.byRegion.flatMap((count, region) =>
      count > 0 && !reached.has(region) ? [region] : [],
    );
    const [first] = fresh;
    if (first === undefined) continue;
    for (const region of fresh) reached.add(region);
    out.push({
      ma: step.ma,
      title: `First found in ${listed(fresh.map((region) => elementAt(data.regions, region)))}`,
      text: `${ago(step.ma)}, ${String(origin.ma - step.ma)} million years after the oldest finds.${climateSaid(step)}`,
      where: mainSite(members, step.ma, first),
    });
  }
  return out;
}

/** How far the warmth where they lay stood from the globe's mean; 0 where it cannot be read. */
function gap(step: StoryStep): number {
  if (step.celsius === null || step.globe === null || step.finds < ENOUGH_FINDS) return 0;
  return step.celsius - step.globe;
}

/** Where the world cooled round them, or they lived in its cold: the widest gap, if wide. */
function apartFromTheGlobe({ clade, members, steps }: Told): Chapter[] {
  const widest = steps.reduce((best, step) =>
    Math.abs(gap(step)) > Math.abs(gap(best)) ? step : best,
  );
  const { celsius, globe } = widest;
  if (celsius === null || globe === null || Math.abs(gap(widest)) < WIDE_GAP) return [];
  return [
    {
      ma: widest.ma,
      title: celsius > globe ? 'Keeping to the warmth' : 'Living in the cold',
      text: `${ago(widest.ma)} the globe averaged ${degrees(globe)}; where the ${plainName(clade)} finds lay it was about ${degrees(celsius)}.`,
      where: mainSite(members, widest.ma, null),
    },
  ];
}

function mostKinds({ data, members, steps }: Told, origin: StoryStep): Chapter[] {
  const peak = steps.reduce((best, step) => (step.kinds > best.kinds ? step : best));
  if (peak.kinds <= 1 || peak === origin) return [];
  return [
    {
      ma: peak.ma,
      title: 'The most kinds at once',
      text: `${ago(peak.ma)}: ${String(peak.kinds)} kinds known, found in ${listed(regionsOf(data, peak))}.`,
      where: mainSite(members, peak.ma, null),
    },
  ];
}

function mostEndings({ members, steps }: Told): Chapter[] {
  const worst = steps.reduce((best, step) => (step.ended.length > best.ended.length ? step : best));
  if (worst.ended.length < MANY_ENDINGS) return [];
  return [
    {
      ma: worst.ma,
      title: 'The most endings',
      text: `${ago(worst.ma)}: the last finds of ${String(worst.ended.length)} kinds, ${named(worst.ended)} among them.`,
      where: mainSite(members, worst.ma, null),
    },
  ];
}

/** The picked kind's own oldest finds, where they are not the story's. */
function focusFinds({ data, focus, steps }: Told, origin: StoryStep): Chapter[] {
  if (focus === null || focus.first === origin.ma) return [];
  const sites = focus.at.get(focus.first) ?? [];
  const regions = [...new Set(sites.map((site) => site.region))];
  const step = steps.find((each) => each.ma === focus.first);
  return [
    {
      ma: focus.first,
      title: `The oldest ${focus.node.name} finds`,
      text: `${ago(focus.first)}, in ${listed(regions.map((region) => elementAt(data.regions, region)))}.${step === undefined ? '' : climateSaid(step)}`,
      where: sites[0] ?? null,
    },
  ];
}

/** How it stands today, or where it ended. */
function ending({ data, members, steps }: Told): Chapter {
  const living = members.filter((kind) => kind.node.living).map((kind) => kind.node);
  if (living.length > 0) {
    return {
      ma: 0,
      title: 'Today',
      text: `${String(living.length)} of its ${String(members.length)} kinds found as fossils ${living.length === 1 ? 'is' : 'are'} living: ${named(living)}.`,
      where: mainSite(members, 0, null),
    };
  }
  const end = elementAt(steps, steps.length - 1);
  return {
    ma: end.ma,
    title: 'The last finds',
    text: `${ago(end.ma)}: ${named(end.ended)}, in ${listed(regionsOf(data, end))}. None of its ${String(members.length)} kinds is living.`,
    where: mainSite(members, end.ma, null),
  };
}

/** A story's moments, oldest first. */
export function chaptersOf(told: Told): Chapter[] {
  const origin = elementAt(told.steps, 0);
  return [
    oldestFinds(told, origin),
    ...firstFound(told, origin),
    ...apartFromTheGlobe(told),
    ...mostKinds(told, origin),
    ...mostEndings(told),
    ...focusFinds(told, origin),
    ending(told),
  ].sort((a, b) => b.ma - a.ma);
}
