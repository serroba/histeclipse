/**
 * What deep time's bar says and offers (#605), worked out apart from the page: what the ice,
 * coast and sea-ice notes say, how far a step goes on each span, the slider's units, where the
 * milestones' ticks fall, and which notes show. Pure and unit-tested; the bar is `deepTimeBar.ts`.
 */

import type { IceStandIn } from '../data/iceSheets';
import type { SeaIceModel } from '../data/seaIce';
import type { CoastSource } from '../deepTime/coastline';
import { anchorMa, MILESTONES } from '../deepTime/milestones';
import type { DeepScale } from '../state/viewState';

/** Each step button moves by one elevation map, or on the ice-age scale by 5,000 years. */
export const STEP_MA = 5;
const ICE_STEP_MA = 0.005;
/** Over all of Earth's history, a step is 50 million years. */
const EONS_STEP_MA = 50;

export const COAST_LABELS: Readonly<Record<CoastSource, string>> = {
  'bintanja-2008': 'Bintanja & van de Wal 2008',
  'spratt-2016': 'Spratt & Lisiecki 2016',
};

export const SEA_ICE_LABELS: Readonly<Record<SeaIceModel, string>> = {
  'mpi-esm1-2-lr': 'MPI-ESM1-2-LR',
  'miroc-es2l': 'MIROC-ES2L',
  'awi-esm-1-1-lr': 'AWI-ESM-1-1-LR',
};

/** Over the ice ages: the sea level the coastlines follow, and whose. */
export interface CoastlineView {
  readonly coast: CoastSource;
  /** Metres from today's; null while the reconstructions load. */
  readonly seaLevel: number | null;
  readonly label: string | null;
  /** The source asked for, when it does not reach and another stands in. */
  readonly instead: string | null;
}

/** "Coastline at −121 m (Bintanja & van de Wal 2008)", with any stand-in said. */
export function coastlineText(view: CoastlineView): string {
  if (view.seaLevel === null || view.label === null) return 'Coastline: loading sea level…';
  const metres = Math.round(view.seaLevel);
  const level =
    metres === 0 ? 'today’s sea level' : `${metres > 0 ? '+' : '−'}${String(Math.abs(metres))} m`;
  const stand =
    view.instead === null
      ? ''
      : ` ${view.instead} does not reach this far; ${view.label} stands in.`;
  return `Coastline at ${level}, following ${view.label}.${stand}`;
}

/** On the ice-age scale: the sea ice drawn, blended from today's towards an ice-age model's. */
export interface SeaIceView {
  readonly model: SeaIceModel;
  /** 0 for today's sea ice, 1 for the glacial maximum's; null while the maps load. */
  readonly mix: number | null;
}

/** What the bar says about the sea ice. */
export function seaIceText(view: SeaIceView): string {
  if (view.mix === null) return 'Sea ice: loading…';
  const key = 'Solid white lasts all year; faint white forms only in winter.';
  if (view.mix < 0.005) return `Sea ice: today’s (NSIDC, 1981–2010). ${key}`;
  const model = SEA_ICE_LABELS[view.model];
  if (view.mix > 0.995) {
    return `Sea ice: the Last Glacial Maximum’s, 21,000 years ago, as the ${model} climate model has it. ${key}`;
  }
  const share = `${String(Math.round(view.mix * 100))}%`;
  return `Sea ice: a stand-in, ${share} of the way from today’s (NSIDC) to the Last Glacial Maximum’s (${model} model), by how far the sea had fallen. ${key}`;
}

/**
 * Whether ice is drawn at the moment shown, how far back the ice maps reach (ka), and, beyond
 * them, which map stands in.
 */
export interface IceView {
  readonly drawn: boolean;
  readonly oldestKa: number | null;
  readonly standIn: IceStandIn | null;
}

/** What the bar says about the ice sheets on the ice-age scale. */
export function iceText(view: IceView): string {
  if (view.oldestKa === null) return 'Ice sheets: loading…';
  const reach = `${(view.oldestKa * 1000).toLocaleString('en')} years`;
  if (view.standIn !== null) {
    const { ka, frameLevel, level } = view.standIn;
    const metres = (value: number) => {
      const rounded = Math.round(value);
      return rounded === 0 ? '0 m' : `${rounded < 0 ? '−' : '+'}${String(Math.abs(rounded))} m`;
    };
    const then =
      ka === 0 ? 'today’s ice' : `the ice of ${(ka * 1000).toLocaleString('en')} years ago`;
    return `Ice sheets: a stand-in. No openly licensed maps reach back beyond ${reach}, so this is ${then}, when sea level was similar (${metres(frameLevel)}, against ${metres(level)} at the moment shown). Sea level tracks how much ice there was, not where: the ice sheets’ shapes may have differed.`;
  }
  return view.drawn
    ? `Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last ${reach}, with today’s ice to the coast (Natural Earth).`
    : `Ice sheets: no openly licensed maps reach back beyond ${reach}; sea level and the bared shelves still show each glacial cycle.`;
}

/** Slider units per million years: thousands of years on the ice-age scale, else millions. */
export function sliderUnit(scale: DeepScale | undefined): number {
  return scale === 'ice' ? 1000 : 1;
}

/** How far a step button moves, Ma, on each span. */
function stepMa(scale: DeepScale | undefined): number {
  return scale === 'ice' ? ICE_STEP_MA : scale === 'eons' ? EONS_STEP_MA : STEP_MA;
}

/** A step, in words, for the step buttons' labels. */
export function stepWords(scale: DeepScale): string {
  return scale === 'ice' ? '5,000 years' : `${String(stepMa(scale))} million years`;
}

/** A step back in time from `ma`, no further than `oldest`; or forward, no later than today. */
export function stepped(ma: number, oldest: number, scale: DeepScale, older: boolean): number {
  return older ? Math.min(oldest, ma + stepMa(scale)) : Math.max(0, ma - stepMa(scale));
}

/** A tick on the time line for each milestone within `oldest`: where along it, as a percentage. */
export function milestoneTicks(
  oldest: number,
): { readonly kind: string; readonly title: string; readonly left: number }[] {
  return MILESTONES.filter((milestone) => anchorMa(milestone) <= oldest).map((milestone) => ({
    kind: milestone.kind,
    title: milestone.title,
    left: (1 - anchorMa(milestone) / oldest) * 100,
  }));
}

/**
 * Which of the moment's notes show: no map before the elevation maps reach, unless the sketch
 * says what is drawn instead; the ice ages' own on that scale.
 */
export function notesShown(view: {
  readonly ma: number;
  readonly mapsReach: number;
  readonly scale: DeepScale;
  readonly sketchQuestions: number | null;
}): {
  readonly uncharted: boolean;
  readonly noMap: boolean;
  readonly sketch: boolean;
  readonly ice: boolean;
} {
  const uncharted = view.ma > view.mapsReach;
  const sketch = view.sketchQuestions !== null && view.sketchQuestions > 0;
  return { uncharted, noMap: uncharted && !sketch, sketch, ice: view.scale === 'ice' };
}
