/**
 * Each extinction against every stage of the Phanerozoic (#1269): the share of marine animal
 * genera each stage lost, counted for this site from the Paleobiology Database's finds (see
 * data-pipeline `marine_diversity.py`), by Alroy's gap-filler rate (2014), with his three-timer
 * rate (2008) and the raw last finds beside it in words.
 *
 * A stage's rate takes in all its losses, the background of a stage millions of years long as
 * well as its crisis, so it runs higher than estimates that set the background apart, as
 * Stanley's (2016) do; the words say so.
 *
 * Pure.
 */

import type { LossGauge, LossGroups, LossHistory } from '../ownTime';
import RATES from './marineExtinctionRates.json' with { type: 'json' };

/** A stage as counted: its age, Ma, its genera, and the share lost three ways. */
interface CountedStage {
  readonly stage: string;
  readonly base: number;
  readonly top: number;
  readonly lastFound: number | null;
  readonly threeTimer: number | null;
  readonly gapFiller: number | null;
}

/** A group's genera last found in each stage, of those whose range spans it, and its last stage. */
interface CountedGroup {
  readonly group: string;
  readonly lastStage: string | null;
  readonly stages: readonly (readonly number[])[];
}

const STAGES: readonly CountedStage[] = RATES.stages;
const GROUPS: readonly CountedGroup[] = RATES.groups;
/** Fewer genera than this say too little of a group's losses to list it. */
const FEWEST_GENERA = 5;
/** A group losing this share or more, yet found after, is said to have lingered. */
const NEARLY_ALL = 0.9;
/** How many groups each extinction lists, most lost first. */
const LISTED = 6;

/** Each extinction's own stages: both pulses of the end-Ordovician. */
export const EXTINCTION_STAGES: Readonly<Record<string, readonly string[]>> = {
  'end-ordovician-extinction': ['Katian', 'Hirnantian'],
  'late-devonian-extinction': ['Frasnian'],
  'end-guadalupian-extinction': ['Capitanian'],
  'end-permian-extinction': ['Changhsingian'],
  'end-triassic-extinction': ['Rhaetian'],
  'k-pg-extinction': ['Maastrichtian'],
};

/** "76%". */
const percent = (share: number | null) => `${String(Math.round(100 * (share ?? 0)))}%`;

/** The middle of the shares an ordinary stage loses, the extinctions' own left out. */
export function typicalLoss(stages: readonly CountedStage[] = STAGES): number {
  const marked = new Set(Object.values(EXTINCTION_STAGES).flat());
  const shares = stages
    .filter(({ stage, gapFiller }) => gapFiller !== null && !marked.has(stage))
    .map(({ gapFiller }) => gapFiller ?? 0)
    .sort((one, other) => one - other);
  return shares[Math.floor(shares.length / 2)] ?? 0;
}

/** The counted stage named `name`. */
function stageNamed(name: string): CountedStage | undefined {
  return STAGES.find(({ stage }) => stage === name);
}

/** The strip for the extinction whose stages are `names`. */
export function historyOf(names: readonly string[]): LossHistory {
  const here = names.map((name) => percent(stageNamed(name)?.gapFiller ?? null)).join(' and ');
  return {
    title: `Marine genera lost, each stage since the Cambrian: here ${here}, an ordinary stage ${percent(typicalLoss())}`,
    stages: STAGES.map(({ stage, base, top, gapFiller }) => ({
      name: stage,
      base,
      top,
      lost: gapFiller,
    })),
    marked: names,
    ends: [
      `${String(Math.round(STAGES[0]?.base ?? 0))} Ma`,
      `${String(Math.round(STAGES.at(-1)?.top ?? 0))} Ma`,
    ],
  };
}

/** The groups the stage named `name` took most of, each with enough genera to say. */
export function groupsOf(name: string): LossGroups {
  const index = STAGES.findIndex(({ stage }) => stage === name);
  const groups = GROUPS.flatMap(({ group, lastStage, stages }) => {
    const [last = 0, genera = 0] = stages[index] ?? [];
    if (genera < FEWEST_GENERA) return [];
    return [{ name: group, lost: last / genera, genera, last: lastStage === name }];
  });
  return {
    title: `Genera last found in the ${name}, by group`,
    groups: groups.sort((one, other) => other.lost - one.lost).slice(0, LISTED),
  };
}

/** What the record's counts say of the stage named `name`. */
export function stageSays(name: string): string {
  const stage = stageNamed(name);
  if (stage === undefined) return '';
  const years = Math.round(stage.base - stage.top);
  return `the ${name}, ${String(years)} million years long, lost ${percent(stage.gapFiller)} (gap-filler rate, Alroy 2014), ${percent(stage.threeTimer)} (three-timer, Alroy 2008), ${percent(stage.lastFound)} last found`;
}

/** `gauge` with its extinction drawn against every stage, and the record's counts said. */
export function withHistory(id: string, gauge: LossGauge): LossGauge {
  const names = EXTINCTION_STAGES[id];
  if (names === undefined) return gauge;
  const counts = names.map(stageSays).join('; ');
  const groups = groupsOf(names[0] ?? '');
  // Nearly all of a group gone, yet some found after: said, lest "the last of them" be missed.
  const lingering = groups.groups
    .filter(({ lost, last }) => lost >= NEARLY_ALL && !last)
    .map(({ name, lost, genera }) => {
      const left = Math.round(genera * (1 - lost));
      return `${String(left)} ${left === 1 ? 'genus' : 'genera'} of ${name.toLowerCase()}`;
    });
  const after =
    lingering.length === 0
      ? ''
      : ` In the database, ${lingering.join(' and ')} ${lingering.length === 1 && lingering[0]?.startsWith('1 ') === true ? 'is' : 'are'} found again after it.`;
  return {
    ...gauge,
    history: historyOf(names),
    // The first of an extinction's stages: the end-Ordovician's larger pulse.
    groups,
    says: `${gauge.says} Counted from the Paleobiology Database’s finds for this site: ${counts}. Each counts its whole stage, the background with the crisis, so runs above estimates that set the background apart; an ordinary stage loses ${percent(typicalLoss())}. The groups, each by its classification in the database, are counted raw, by the genera last found, with no correction for those the record misses; “the last of them” where none is found in any later stage.${after}`,
  };
}
