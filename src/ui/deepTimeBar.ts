/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present.
 * Mobile first: 44 px targets, like the year bar it replaces.
 */

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { earthFacts } from '../deepTime/earthFacts';
import { polaritySpans } from '../deepTime/earthState';
import { anchorMa, MILESTONES } from '../deepTime/milestones';
import { formatMa, type Period, periodShort } from '../deepTime/periods';
import { gasText, type Atmosphere } from '../data/atmosphere';
import { IMPACTS_MODES, type ImpactsMode } from '../data/impacts';
import {
  co2Text,
  NITROGEN_NOTE,
  O2_TODAY,
  o2Text,
  PREINDUSTRIAL_CO2,
  type DeepAir,
} from '../data/deepAir';
import { archiveDots, archiveText, studiesNear, type Co2Archive } from '../data/co2Archive';
import { createBandChart } from './bandChart';
import type { IceOutlines } from '../data/iceOutlines';
import type { PolarityScale } from '../data/polarity';
import type { IceStandIn } from '../data/iceSheets';
import { SEA_ICE_MODELS, type SeaIceModel } from '../data/seaIce';
import type { SeaLevelIndex } from '../data/seaLevel';
import { COAST_SOURCES, type CoastSource } from '../deepTime/coastline';
import {
  TEMPERATURE_MODEL_LABELS,
  TEMPERATURE_MODELS,
  type TemperatureModel,
} from '../deepTime/temperatureModels';
import {
  IMPACT_MODELS,
  IMPACTS,
  LAND_CHOICES,
  LAND_MODELS,
  type Sketch,
  type SketchChoices,
  type SketchQuestion,
  SNOWBALL_CHOICES,
  SNOWBALL_MODELS,
} from '../deepTime/sketch';
import { DEEP_SPEEDS, deepSpeedText, deepSpeedWords } from '../deepTime/playSpeed';
import { sketchHeadline, sketchLines } from '../deepTime/sketchText';
import type { DeepScale, Layer } from '../state/viewState';
import type { WhyId } from '../sources/registry';
import { element } from './dom';
import { createDeepChips, type DeepChip, type DeepChipView } from './deepChips';
import { bookIcon, uiIcon } from './icons';
import { createGasChart } from './gasChart';
import { createMilestonePanel } from './milestonePanel';
import { createPeriodBands } from './periodBands';
import { createPolarityStrip } from './polarityStrip';
import { createSeaLevelChart } from './seaLevelChart';
import './deepTimeBar.css';

/** Each step button moves by one elevation map, or on the ice-age scale by 5,000 years. */
export const STEP_MA = 5;
export const ICE_STEP_MA = 0.005;
/** Over all of Earth's history, a step is 50 million years. */
export const EONS_STEP_MA = 50;

const COAST_LABELS: Readonly<Record<CoastSource, string>> = {
  'bintanja-2008': 'Bintanja & van de Wal 2008',
  'spratt-2016': 'Spratt & Lisiecki 2016',
};

/** One model's global mean at the moment shown and today, °C; `mean` null beyond its reach. */
export interface TemperatureReading {
  readonly model: TemperatureModel;
  readonly mean: number | null;
  readonly today: number | null;
  /** How far back its maps reach, Ma. */
  readonly reach: number;
}

export interface TemperatureView {
  readonly on: boolean;
  /** The model asked for, and the one colouring the globe (null while the maps load). */
  readonly wanted: TemperatureModel;
  readonly shown: TemperatureModel | null;
  /** Every model loaded so far, in a fixed order. */
  readonly readings: readonly TemperatureReading[];
  /** What the site says about the map shown, if anything. */
  readonly note: string | null;
}

/** The legend's stops, °C, matching the globe's shader. */
export const TEMPERATURE_STOPS: readonly (readonly [number, string])[] = [
  [-40, '#313695'],
  [-20, '#4575b4'],
  [-5, '#91bfdb'],
  [5, '#e0f3f8'],
  [15, '#fee090'],
  [22, '#fdae61'],
  [28, '#f46d43'],
  [35, '#d73027'],
  [45, '#a50026'],
];

/** What each colour of the scale stands for: a stop's temperature, and what it is like. */
export const TEMPERATURE_KEY: readonly { readonly celsius: number; readonly label: string }[] = [
  { celsius: -40, label: 'ice-cap cold' },
  { celsius: -20, label: 'bitter cold' },
  { celsius: -5, label: 'below freezing' },
  { celsius: 5, label: 'cool' },
  { celsius: 15, label: 'mild (today’s global mean)' },
  { celsius: 22, label: 'warm' },
  { celsius: 28, label: 'hot (tropical)' },
  { celsius: 35, label: 'very hot' },
  { celsius: 45, label: 'extreme heat' },
];

/** The ticks under the scale: each temperature and how far along it is placed, 0 to 1. */
export function scaleTicks(
  stops: readonly (readonly [number, string])[],
  ticks: readonly number[],
): readonly { readonly celsius: number; readonly at: number }[] {
  const first = stops[0]?.[0] ?? 0;
  const last = stops.at(-1)?.[0] ?? 1;
  return ticks.map((celsius) => ({ celsius, at: (celsius - first) / (last - first) }));
}

/** "−40 °C", with a true minus sign. */
export function celsiusText(celsius: number): string {
  return `${celsius < 0 ? '−' : ''}${String(Math.abs(celsius))} °C`;
}

/** A CSS gradient through the stops, placed by temperature. */
export function legendGradient(stops: readonly (readonly [number, string])[]): string {
  const first = stops[0]?.[0] ?? 0;
  const last = stops.at(-1)?.[0] ?? 1;
  const placed = stops.map(
    ([celsius, colour]) => `${colour} ${((100 * (celsius - first)) / (last - first)).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${placed.join(', ')})`;
}

/** "Global mean: Scotese 2022 32.9 °C (today 14.6 °C) · CESM, Li et al. 2023 25.5 °C …". */
export function temperatureText(view: TemperatureView): string {
  if (view.readings.length === 0) return 'Loading temperature maps…';
  const each = view.readings.map(({ model, mean, today, reach }) => {
    const label = TEMPERATURE_MODEL_LABELS[model];
    if (mean === null) return `${label} — covers the last ${String(reach)} million years`;
    const now = today === null ? '' : ` (today ${today.toFixed(1)} °C)`;
    return `${label} ${mean.toFixed(1)} °C${now}`;
  });
  return `Global mean: ${each.join(' · ')}`;
}

/** Which model colours the globe, any stand-in, and the coarse model's limits. */
export function temperatureMapText(view: TemperatureView): string {
  if (view.shown === null) return '';
  const shown = TEMPERATURE_MODEL_LABELS[view.shown];
  const stand =
    view.shown === view.wanted
      ? ''
      : ` ${TEMPERATURE_MODEL_LABELS[view.wanted]} does not reach this far.`;
  const limits =
    view.shown === 'cesm'
      ? ' Its grid is about 3.75° and its geography its own, so its warm and cold patches do not follow these coasts exactly.'
      : ' A HadCM3L climate model adjusted to rock and isotope records.';
  return `The globe shows ${shown}.${stand}${limits}`;
}

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

export const SEA_ICE_LABELS: Readonly<Record<SeaIceModel, string>> = {
  'mpi-esm1-2-lr': 'MPI-ESM1-2-LR',
  'miroc-es2l': 'MIROC-ES2L',
  'awi-esm-1-1-lr': 'AWI-ESM-1-1-LR',
};

/** What the bar says about the ice sheets on the ice-age scale. */
export function iceText(view: DeepTimeView['ice']): string {
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
    ? `Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last ${reach}.`
    : `Ice sheets: no openly licensed maps reach back beyond ${reach}; sea level and the bared shelves still show each glacial cycle.`;
}

/** How a span of thousands of years ago reads: in thousands, or in millions from 1,000 ka. */
function kaSpan(fromKa: number, toKa: number): string {
  if (toKa >= 1000) {
    const ma = (ka: number) => (ka / 1000).toLocaleString('en', { maximumFractionDigits: 2 });
    return `${ma(fromKa)}–${ma(toKa)} million years ago`;
  }
  const years = (ka: number) => (ka * 1000).toLocaleString('en');
  return `${years(fromKa)}–${years(toKa)} years ago`;
}

/** What the bar says about Batchelor et al.'s outlines of the time slice shown, if any. */
export function iceOutlineText(outlines: IceOutlines | null): string | null {
  if (outlines === null) return null;
  const credit = 'Batchelor et al. (2019)';
  const compare = 'Where the white ice and the outlines differ, the reconstructions disagree.';
  if (outlines.min.length === 0 && outlines.max.length === 0) {
    return `Outlines: ${credit}’s best estimate for the Last Glacial Maximum, about 26,500 years ago. ${compare}`;
  }
  const point = /^(\d+) ka$/.exec(outlines.name);
  const when =
    point?.[1] === undefined
      ? `${outlines.name} (${kaSpan(outlines.fromKa, outlines.toKa)})`
      : `about ${(Number(point[1]) * 1000).toLocaleString('en')} years ago`;
  return `Outlines: ${credit}, ${when}: their best estimate (solid gold), minimum (dotted blue) and maximum (dashed red) of the ice sheets at their largest. ${compare}`;
}

export interface DeepTimeView {
  readonly ma: number;
  /** The oldest moment the maps reach, Ma. */
  readonly oldest: number;
  readonly period: Period | null;
  /** Every reversal of the last 83 Ma, once loaded (null until then). */
  readonly polarity: PolarityScale | null;
  readonly playing: boolean;
  /** How fast it plays, millions of years a second: one of the span's own speeds. */
  readonly speed: number;
  /** The span shown; `oldest` is its start. */
  readonly scale: DeepScale;
  /** How far back the elevation maps reach, Ma; before it the globe is blank. */
  readonly mapsReach: number;
  readonly temperature: TemperatureView;
  /** Whether a second reconstruction's continents are outlined, and what to say of them. */
  readonly plates: boolean;
  /**
   * The air: off, or on with the ice-core gases (on the ice-age scale) or the gases of the last
   * 540 million years (on that scale), each null while it loads.
   */
  readonly air:
    | { readonly on: false }
    | {
        readonly on: true;
        readonly atmosphere: Atmosphere | null;
        readonly deep: DeepAir | null;
        /** The Paleo-CO2 Data Archive, once asked for (null until it loads). */
        readonly archive: Co2Archive | null;
      };
  /** The features' chips (#380), by layer: whether each is offered and on, and its note. */
  readonly chips: ReadonlyMap<Layer, DeepChipView>;
  /** Impact craters and deposits: off, on while they load (null), or on with what to say. */
  readonly impacts:
    | { readonly on: false }
    | { readonly on: true; readonly text: string | null; readonly mode: ImpactsMode };
  readonly platesText: string | null;
  /** The ice-age coastline; null before the ice ages. */
  readonly coastline: CoastlineView | null;
  /** The sea ice; null off the ice-age scale. */
  readonly seaIce: SeaIceView | null;
  /**
   * Whether ice is drawn at the moment shown, how far back the ice maps reach (ka), and, beyond
   * them, which map stands in.
   */
  readonly ice: {
    readonly drawn: boolean;
    readonly oldestKa: number | null;
    readonly standIn: IceStandIn | null;
  };
  /** How far the plates have moved since the moment shown, on the ice-age scale; null if not known. */
  readonly plateMotion: string | null;
  /** Batchelor et al.'s outlines of the time slice shown, on the ice-age scale; null if none. */
  readonly iceOutlines: IceOutlines | null;
  /** Sea level: off, on while the reconstructions load (null), or on with them. */
  readonly seaLevel:
    { readonly on: false } | { readonly on: true; readonly index: SeaLevelIndex | null };
  /** Before the reconstructions: the hypotheses sketched, and whose; null where a map reaches. */
  readonly sketch: { readonly sketch: Sketch; readonly choices: SketchChoices } | null;
}

export interface DeepTimeBar {
  readonly root: HTMLElement;
  render(view: DeepTimeView | null): void;
}

export function createDeepTimeBar(
  handlers: {
    /** The book that says where a note's content comes from. */
    why(id: WhyId, label: string): HTMLElement;
    /** Open the why of `id` in full: the map's evidence, from its own chip. */
    explain(id: WhyId): void;
    /** A new moment: `jump` when it is a step to go back from (a milestone, a click), not a drag. */
    onMa(ma: number, jump: boolean): void;
    onPlay(playing: boolean): void;
    /** A speed picked, millions of years a second, for the span shown. */
    onSpeed(maPerSecond: number): void;
    onTemperature(on: boolean): void;
    onSeaLevel(on: boolean): void;
    onPlates(on: boolean): void;
    /** A feature's chip pressed: its layer on or off. */
    onLayer(layer: Layer, on: boolean): void;
    onImpacts(on: boolean): void;
    /** Show each impact around its time, or every one that had struck by then. */
    onImpactsMode(mode: ImpactsMode): void;
    onAir(on: boolean): void;
    /** The reader asked for the Paleo-CO2 Data Archive's estimates: load them. */
    onCo2Archive(): void;
    onCoast(coast: CoastSource): void;
    onSeaIce(model: SeaIceModel): void;
    onTemperatureModel(model: TemperatureModel): void;
    onSketch(choice: Partial<SketchChoices>): void;
  },
  chips: readonly DeepChip[] = [],
): DeepTimeBar {
  const play = element(
    'button',
    { type: 'button', class: 'step deep-play', 'aria-label': 'Play' },
    '▶',
  );
  // The span's own speeds, in its own units; offered anew when the span changes.
  const speed = element('select', { class: 'deep-speed', 'aria-label': 'Speed' });
  let speedsOf: DeepScale | null = null;
  speed.addEventListener('change', () => {
    handlers.onSpeed(Number(speed.value));
  });
  const older = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': `${String(STEP_MA)} million years earlier` },
    '‹',
  );
  const younger = element(
    'button',
    { type: 'button', class: 'step', 'aria-label': `${String(STEP_MA)} million years later` },
    '›',
  );
  // The slider's value is minus the time ago, so dragging right moves towards the present: in
  // millions of years, or thousands on the ice-age scale.
  const slider = element('input', {
    type: 'range',
    class: 'deep-slider',
    min: '-540',
    max: '0',
    step: '1',
    'aria-label': 'Millions of years ago',
  });
  const unchartedNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'uncharted-note' },
    'No map: before 540 million years ago no surface map reaches. The Plates layer fills in one reconstruction’s continents back to 1,800 million years. Before that, and for snowball ice, the globe sketches what competing hypotheses say; pick whose below.',
  );
  // One picker per question a sketch can answer; only those the moment asks are shown.
  const sketchPickers: Readonly<Record<SketchQuestion, HTMLSelectElement>> = {
    impact: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'Moon-forming impact' },
      ...IMPACT_MODELS.map((model) => element('option', { value: model }, IMPACTS[model].label)),
    ),
    land: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'How much land' },
      ...LAND_MODELS.map((model) => element('option', { value: model }, LAND_CHOICES[model].label)),
    ),
    snowball: element(
      'select',
      { class: 'deep-coast', 'aria-label': 'Snowball ice' },
      ...SNOWBALL_MODELS.map((model) =>
        element('option', { value: model }, SNOWBALL_CHOICES[model].label),
      ),
    ),
  };
  const SKETCH_QUESTIONS: readonly SketchQuestion[] = ['impact', 'land', 'snowball'];
  const sketchRow = (question: SketchQuestion, label: string): HTMLElement =>
    element('p', { hidden: '' }, element('label', {}, label, sketchPickers[question]));
  const sketchRows: Readonly<Record<SketchQuestion, HTMLElement>> = {
    impact: sketchRow('impact', 'Moon-forming impact '),
    land: sketchRow('land', 'How much land '),
    snowball: sketchRow('snowball', 'Snowball ice '),
  };
  // In view: one line and the pickers. What it rests on is folded, so a phone still sees the globe.
  const sketchHead = element('p', { 'data-testid': 'sketch-headline' });
  const sketchNote = element(
    'div',
    { class: 'deep-note', hidden: '', 'data-testid': 'sketch-note' },
    sketchHead,
    ...SKETCH_QUESTIONS.map((question) => sketchRows[question]),
  );
  const sketchWords = element('div', {});
  const sketchSources = element(
    'details',
    { class: 'deep-facts', hidden: '', 'data-testid': 'sketch-sources', name: 'deep-fold' },
    element('summary', {}, 'What the sketch rests on'),
    element(
      'div',
      { class: 'colour-key-body' },
      element(
        'p',
        {},
        'No surface map reaches before 540 million years ago, and the continent reconstruction stops at 1,800 million. Before that, and for snowball ice, the globe sketches what competing hypotheses say.',
      ),
      sketchWords,
    ),
  );
  const coastText = element('span', { 'data-testid': 'coastline' });
  const iceLine = element('p', { 'data-testid': 'ice-sheets' });
  const outlineLine = element('p', { 'data-testid': 'ice-outlines', hidden: '' });
  const motionLine = element('p', { 'data-testid': 'plate-motion', hidden: '' });
  const seaIceWords = element('span', { 'data-testid': 'sea-ice' });
  const seaIcePicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Ice-age sea ice from' },
    ...SEA_ICE_MODELS.map((model) => element('option', { value: model }, SEA_ICE_LABELS[model])),
  );
  const coastPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Coastline follows' },
    ...COAST_SOURCES.map((source) => element('option', { value: source }, COAST_LABELS[source])),
  );
  // The books beside each note, made once: the notes that are drawn again keep them first.
  const iceWhy = handlers.why('ice-surface', 'The ice ages’ Earth');
  const coastWhy = handlers.why('ice-surface', 'The coast and sea level');
  const platesWhy = handlers.why('plates', 'Plates');
  const temperatureWhy = handlers.why('temperature', 'Temperature');
  const factsWhy = handlers.why('earth-facts', 'Poles, magnetic field, tilt, day and Sun');
  const airWhy = handlers.why('air', 'Air');
  const impactsWhy = handlers.why('impacts', 'Impact craters');
  // What the map rests on, asked plainly, first among the chips: a reconstruction should say so.
  const evidenceButton = element(
    'button',
    { type: 'button', class: 'deep-layer deep-evidence', hidden: '' },
    bookIcon(),
    'How do we know?',
  );
  evidenceButton.addEventListener('click', () => {
    handlers.explain('deep-evidence');
  });
  const iceNote = element(
    'div',
    { class: 'deep-note', hidden: '', 'data-testid': 'ice-note' },
    element(
      'p',
      {},
      iceWhy,
      ' ',
      'The last 2.6 million years: today’s land and sea floor, with the coast drawn at the sea level of the time. Sea floor laid dry is sandy; ice sheets are white. The continents are drawn where they are today (how far they have moved is below), and the temperature maps are 5 million years apart.',
    ),
    iceLine,
    outlineLine,
    motionLine,
    element(
      'p',
      {},
      seaIceWords,
      ' ',
      element('label', {}, 'Ice-age model ', seaIcePicker),
      ' Three climate models (PMIP4) differ; pick one.',
    ),
  );
  const coastNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'coast-note' },
    coastWhy,
    ' ',
    coastText,
    ' ',
    element('label', {}, 'Follow ', coastPicker),
    ' Drawn on NOAA’s present-day depths (ETOPO1); each source is measured from its own present day.',
  );
  const when = element('strong', { class: 'deep-when', 'data-testid': 'deep-when' });
  const period = element('span', { class: 'deep-period', 'data-testid': 'deep-period' });
  const platesButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false', title: 'Plates' },
    uiIcon('plates'),
    element('span', { class: 'icon-label' }, 'Plates'),
  );
  const platesWords = element('span', {});
  const platesNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'plates-note' },
    platesWhy,
    ' ',
    element('span', { class: 'plates-swatch', 'aria-hidden': 'true' }),
    ' ',
    platesWords,
  );
  const airButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false', hidden: '', title: 'Air' },
    uiIcon('air'),
    element('span', { class: 'icon-label' }, 'Air'),
  );
  const airNote = element('div', {
    class: 'deep-note air-note',
    hidden: '',
    'data-testid': 'air-note',
  });
  const gasCharts = { co2: createGasChart(), ch4: createGasChart() };
  // The features' chips (#380): each a button and a note, made once.
  const featureChips = createDeepChips(
    chips,
    (id, label) => handlers.why(id, label),
    (layer, on) => {
      handlers.onLayer(layer, on);
    },
  );
  const impactsButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false', hidden: '', title: 'Impacts' },
    uiIcon('impacts'),
    element('span', { class: 'icon-label' }, 'Impacts'),
  );
  const impactsMode = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Show impacts' },
    element('option', { value: 'around' }, 'each around its time'),
    element('option', { value: 'struck' }, 'all that had struck by then'),
  );
  impactsMode.addEventListener('change', () => {
    const mode = IMPACTS_MODES.find((each) => each === impactsMode.value);
    if (mode !== undefined) handlers.onImpactsMode(mode);
  });
  const impactsPicker = element('label', { class: 'impacts-picker' }, 'Show impacts ', impactsMode);
  const impactsNote = element('p', {
    class: 'deep-note impacts-note',
    hidden: '',
    'data-testid': 'impacts-note',
  });
  const seaLevelButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false', title: 'Sea level' },
    uiIcon('seaLevel'),
    element('span', { class: 'icon-label' }, 'Sea level'),
  );
  const seaLevel = createSeaLevelChart({
    onKa(ka) {
      handlers.onMa(ka / 1000, true);
    },
  });
  const temperatureButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false', title: 'Temperature' },
    uiIcon('temperature'),
    element('span', { class: 'icon-label' }, 'Temperature'),
  );
  const legendScale = element('span', { class: 'temperature-scale', 'aria-hidden': 'true' });
  legendScale.style.background = legendGradient(TEMPERATURE_STOPS);
  const legendMean = element('span', { 'data-testid': 'temperature-mean' });
  const legendNote = element('p', { class: 'temperature-note', hidden: '' });
  const legendMap = element('span', { 'data-testid': 'temperature-map' });
  const modelPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Temperature model' },
    ...TEMPERATURE_MODELS.map((model) =>
      element('option', { value: model }, TEMPERATURE_MODEL_LABELS[model]),
    ),
  );
  const swatch = (background: string) => {
    const box = element('span', { class: 'colour-swatch', 'aria-hidden': 'true' });
    box.style.background = background;
    return box;
  };
  // The scale, its ticks in °C under it, and each colour named: what the globe's colours mean.
  const ticks = element(
    'div',
    { class: 'temperature-ticks', 'aria-hidden': 'true' },
    ...scaleTicks(TEMPERATURE_STOPS, [-40, -20, 0, 15, 30, 45]).map(({ celsius, at }) => {
      const tick = element('span', {}, celsiusText(celsius));
      tick.style.left = `${(at * 100).toFixed(1)}%`;
      return tick;
    }),
  );
  const named = element(
    'ul',
    { class: 'colour-key temperature-key', 'data-testid': 'temperature-key' },
    ...TEMPERATURE_KEY.map(({ celsius, label }) => {
      const colour = TEMPERATURE_STOPS.find(([stop]) => stop === celsius)?.[1] ?? '#888';
      return element(
        'li',
        {},
        swatch(colour),
        `${celsiusText(celsius)}${celsius === -40 ? ' or colder' : celsius === 45 ? ' or hotter' : ''}: ${label}`,
      );
    }),
  );
  const legend = element(
    'div',
    { class: 'temperature-legend', hidden: '' },
    element(
      'p',
      { class: 'temperature-heading' },
      'Colours: the average temperature at the surface over a year ',
      temperatureWhy,
    ),
    legendScale,
    ticks,
    named,
    element('p', {}, legendMean),
    element('p', {}, legendMap, ' ', element('label', {}, 'Colour by ', modelPicker)),
    legendNote,
  );
  // Poles, field, tilt and day: folded away, so the bar stays small on a phone.
  const facts = element('dl', { class: 'deep-facts-list' });
  const factsPanel = element(
    'details',
    { class: 'deep-facts', 'data-testid': 'deep-facts', name: 'deep-fold' },
    element('summary', {}, 'Poles, magnetic field, tilt, day and Sun ', factsWhy),
    facts,
  );
  // What the colours mean: the map's and the ticks'. Folded away like the facts.
  const colourKey = element(
    'details',
    { class: 'deep-facts deep-key', 'data-testid': 'deep-key', name: 'deep-fold' },
    element('summary', {}, 'What the colours mean'),
    element(
      'div',
      { class: 'colour-key-body' },
      element(
        'ul',
        { class: 'colour-key' },
        ...MAP_KEY.map(({ label, swatch: background }) =>
          element('li', {}, swatch(background), label),
        ),
      ),
      element('p', { class: 'colour-key-heading' }, 'Ticks on the time line: milestones'),
      element(
        'ul',
        { class: 'colour-key' },
        ...MILESTONE_KEY.map(({ kind, label }) =>
          element(
            'li',
            {},
            element('span', { class: `colour-tick milestone-${kind}`, 'aria-hidden': 'true' }),
            label,
          ),
        ),
      ),
      element(
        'p',
        { class: 'colour-key-heading' },
        'With Temperature on, the map shows °C instead, on the scale above.',
      ),
    ),
  );
  // A tick on the track for each milestone, placed when the time line's span is known.
  const marks = element('div', { class: 'deep-marks', 'aria-hidden': 'true' });
  const bands = createPeriodBands((ma) => {
    handlers.onMa(ma, true);
  });
  const polarityStrip = createPolarityStrip();
  const track = element(
    'div',
    { class: 'deep-track' },
    seaLevel.chart,
    slider,
    marks,
    bands.root,
    polarityStrip.root,
  );
  const milestones = createMilestonePanel({
    onMa(ma) {
      handlers.onMa(ma, true);
    },
  });
  // The notes, legends, milestones and folds: on a phone folded away until asked for, so the
  // globe stays in view; open, they scroll inside the bar rather than the page.
  const details = element(
    'div',
    { class: 'deep-details', id: 'deep-details', 'data-testid': 'deep-details' },
    iceNote,
    unchartedNote,
    sketchNote,
    coastNote,
    seaLevel.legend,
    legend,
    platesNote,
    ...featureChips.notes,
    impactsNote,
    airNote,
    milestones.root,
    // One open at a time (they share a name), so the bar doesn't grow over the globe.
    element('div', { class: 'deep-folds' }, colourKey, sketchSources, factsPanel),
  );
  const handle = element(
    'button',
    { type: 'button', class: 'deep-handle', 'aria-controls': 'deep-details' },
    element('span', { class: 'deep-handle-grip', 'aria-hidden': 'true' }),
  );
  const root = element(
    'nav',
    { class: 'deep-time', 'aria-label': 'Deep time', hidden: '' },
    handle,
    element('div', { class: 'deep-controls' }, play, older, track, younger),
    element(
      'p',
      { class: 'deep-label' },
      when,
      ' ',
      period,
      // Beside the moment, not the slider: on a phone the slider needs the whole row.
      speed,
      evidenceButton,
      seaLevelButton,
      temperatureButton,
      platesButton,
      ...featureChips.buttons,
      impactsButton,
      airButton,
    ),
    details,
  );
  // Open or folded as the reader last left it; at first, folded on a phone, open elsewhere.
  const SHEET_KEY = 'histeclipse.deepSheet';
  function remembered(): string | null {
    try {
      return localStorage.getItem(SHEET_KEY);
    } catch {
      return null;
    }
  }
  let open =
    (remembered() ?? (window.matchMedia('(max-width: 600px)').matches ? 'folded' : 'open')) ===
    'open';
  function setOpen(value: boolean, keep = true): void {
    if (keep) {
      try {
        localStorage.setItem(SHEET_KEY, value ? 'open' : 'folded');
      } catch {
        // Not kept, as in a private window: the sheet still works.
      }
    }
    open = value;
    root.dataset['sheet'] = value ? 'open' : 'folded';
    handle.setAttribute('aria-expanded', String(value));
    handle.setAttribute('aria-label', value ? 'Hide the details' : 'Show the details');
  }
  setOpen(open, false);
  handle.addEventListener('click', () => {
    landSettle();
    setOpen(!open);
  });
  // The details follow a finger dragged up or down the bar, and settle open or folded when it
  // lifts: by a flick's direction, else by whether they are more than half open. Not on the
  // slider or a picker, whose own drags are left alone; and a drag down inside the details
  // scrolls them until they are at their top. A mouse can drag the handle the same way.
  /** Pixels a finger moves before a drag counts, so taps stay taps. */
  const DRAG_SLOP = 8;
  /** A release faster than this, in pixels a millisecond, settles the way it was going. */
  const FLICK = 0.5;
  const SETTLE_MS = 200;
  /** A gesture shorter than this is a flick, judged by its whole length and time. */
  const FLICK_MS = 250;
  /** Held still this long before lifting, the finger has no speed left. */
  const STILL_MS = 100;
  interface Drag {
    readonly x: number;
    readonly y: number;
    readonly t: number;
    readonly scrolled: number;
    /** Set once the move is a drag: the details' height then, and opened in full. */
    from: number | null;
    full: number;
    last: { readonly y: number; readonly t: number };
    speed: number;
  }
  let drag: Drag | null = null;
  // A settle under way, finished at once if a new drag starts before it lands: else the new
  // drag would start from the state before it, and the old settle land after the new one.
  let settling: { readonly timer: number; readonly opening: boolean } | null = null;
  function landSettle(): void {
    if (settling === null) return;
    window.clearTimeout(settling.timer);
    details.style.transition = '';
    details.style.height = '';
    setOpen(settling.opening);
    settling = null;
  }
  function begin(x: number, y: number, t: number): void {
    drag = {
      x,
      y,
      t,
      scrolled: details.scrollTop,
      from: null,
      full: 0,
      last: { y, t },
      speed: 0,
    };
  }
  function follow(x: number, y: number, t: number): boolean {
    const now = drag;
    if (now === null) return false;
    const dy = y - now.y;
    if (now.from === null) {
      if (Math.abs(dy) < DRAG_SLOP || Math.abs(dy) < Math.abs(x - now.x)) return false;
      // Down inside details scrolled away from their top is a scroll, not a fold.
      if (dy > 0 && now.scrolled > 0) {
        drag = null;
        return false;
      }
      landSettle();
      // Measure once: how tall the details are now, and opened in full (up to their limit).
      now.from = open ? details.getBoundingClientRect().height : 0;
      root.dataset['sheet'] = 'dragging';
      details.style.height = 'auto';
      const limit = Number.parseFloat(getComputedStyle(details).maxHeight);
      now.full = Math.min(details.scrollHeight, Number.isFinite(limit) ? limit : Infinity);
    }
    const height = Math.min(now.full, Math.max(0, now.from - dy));
    details.style.height = `${String(height)}px`;
    const elapsed = t - now.last.t;
    if (elapsed > 0) now.speed = (y - now.last.y) / elapsed;
    now.last = { y, t };
    return true;
  }
  function release(t: number): void {
    const now = drag;
    drag = null;
    // A tap, not a drag: the handle's click, or nothing.
    if (now === null) return;
    if (now.from === null) return;
    const height = details.getBoundingClientRect().height;
    const speed =
      t - now.t < FLICK_MS
        ? (now.last.y - now.y) / Math.max(1, now.last.t - now.t)
        : t - now.last.t > STILL_MS
          ? 0
          : now.speed;
    const opening = speed < -FLICK ? true : speed > FLICK ? false : height > now.full / 2;
    details.style.transition = `height ${String(SETTLE_MS)}ms ease-out`;
    details.style.height = `${String(opening ? now.full : 0)}px`;
    settling = { timer: window.setTimeout(landSettle, SETTLE_MS), opening };
  }
  root.addEventListener(
    'touchstart',
    (event) => {
      const touch = event.touches[0];
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.touches.length === 1 &&
        touch !== undefined &&
        (target?.closest('input, select, .deep-controls') ?? null) === null
      ) {
        begin(touch.clientX, touch.clientY, event.timeStamp);
      } else drag = null;
    },
    { passive: true },
  );
  root.addEventListener(
    'touchmove',
    (event) => {
      const touch = event.touches[0];
      if (touch === undefined) return;
      // Once it is a drag, the sheet moves and the page and the details stay put.
      if (follow(touch.clientX, touch.clientY, event.timeStamp) && event.cancelable) {
        event.preventDefault();
      }
    },
    { passive: false },
  );
  for (const type of ['touchend', 'touchcancel'] as const) {
    root.addEventListener(
      type,
      (event) => {
        release(event.timeStamp);
      },
      { passive: true },
    );
  }
  // A mouse drags by the handle; a click on it still toggles.
  let dragged = false;
  handle.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse') return;
    dragged = false;
    handle.setPointerCapture(event.pointerId);
    begin(event.clientX, event.clientY, event.timeStamp);
  });
  handle.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && follow(event.clientX, event.clientY, event.timeStamp)) {
      dragged = true;
    }
  });
  handle.addEventListener('pointerup', (event) => {
    if (event.pointerType === 'mouse') release(event.timeStamp);
  });
  handle.addEventListener(
    'click',
    (event) => {
      // The click that ends a mouse drag is not a tap.
      if (dragged) event.stopImmediatePropagation();
      dragged = false;
    },
    { capture: true },
  );

  const deepCharts = {
    co2: createBandChart({ low: 100, high: 6000, log: true, testId: 'deep-co2-chart' }),
    o2: createBandChart({ low: 0, high: 45, log: false, testId: 'deep-o2-chart' }),
  };

  // Whose CO2 estimates the dots show (Foster et al.'s compilation, or the archive's, by method):
  // the reader's choice, kept while the bar is open.
  const co2Source = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'CO₂ estimates from' },
    element('option', { value: 'foster' }, 'Foster et al. 2017 compilation'),
    element('option', { value: 'archive' }, 'Paleo-CO₂ Data Archive (2025)'),
  );
  const co2Method = element('select', { class: 'deep-coast', 'aria-label': 'CO₂ method' });
  const co2Methods = element('label', { hidden: '' }, ' Method ', co2Method);
  const co2Picker = element(
    'p',
    { class: 'co2-picker' },
    element('label', {}, 'Dots: estimates from ', co2Source),
    co2Methods,
  );
  /** The archive's estimates near the moment, with their studies, when the reader picks it. */
  const archiveNote = element('p', { 'data-testid': 'co2-archive', hidden: '' });
  let methodsListed: Co2Archive | null = null;
  const pickedMethod = () => (co2Method.value === '' ? null : Number(co2Method.value));
  for (const picker of [co2Source, co2Method]) {
    picker.addEventListener('change', () => {
      if (co2Source.value === 'archive') handlers.onCo2Archive();
      if (current !== null) bar.render(current);
    });
  }

  /** The Paleo-CO2 Data Archive's dots and words, once it has loaded. */
  function archiveDotsAndWords(archive: Co2Archive | null, ma: number) {
    co2Methods.hidden = archive === null;
    archiveNote.hidden = false;
    if (archive === null) {
      archiveNote.replaceChildren('Loading the Paleo-CO₂ Data Archive…');
      return { dots: [], key: 'archive-loading' };
    }
    if (methodsListed !== archive) {
      methodsListed = archive;
      co2Method.replaceChildren(
        element('option', { value: '' }, 'All methods'),
        ...archive.methods.map((name, at) => element('option', { value: String(at) }, name)),
      );
    }
    const method = pickedMethod();
    const studies = studiesNear(archive, ma, 5, method).slice(0, 6);
    archiveNote.replaceChildren(
      `${archiveText(archive, ma, 5, method)} `,
      ...(studies.length === 0
        ? []
        : [
            'Studies: ',
            ...studies.flatMap(({ label, doi, count }, at) => [
              ...(at === 0 ? [] : [' · ']),
              doi === null
                ? `${label} (${String(count)})`
                : element('a', { href: `https://doi.org/${doi}` }, `${label} (${String(count)})`),
            ]),
            '. ',
          ]),
      element('a', { href: archive.source }, 'Paleo-CO₂ Data Archive'),
      ' (CC BY 4.0).',
    );
    return { dots: archiveDots(archive, method), key: `archive ${co2Method.value}` };
  }

  /** On the 540 Myr scale: CO2 and O2 with their ranges, and nitrogen in words. */
  function renderDeepAir(
    deep: DeepAir | null,
    archive: Co2Archive | null,
    oldest: number,
    ma: number,
  ): void {
    if (deep === null) {
      airNote.replaceChildren(airWhy, ' ', element('p', {}, 'Air: loading…'));
      return;
    }
    const fromArchive = co2Source.value === 'archive';
    if (!fromArchive) {
      co2Methods.hidden = true;
      archiveNote.hidden = true;
    }
    const picked = fromArchive
      ? archiveDotsAndWords(archive, ma)
      : {
          dots: deep.co2.proxies.flatMap(({ estimates }) =>
            estimates.map(([at, value]) => [at, value] as const),
          ),
          key: 'foster',
        };
    deepCharts.co2.render(
      {
        bands: [
          deep.co2.fit.map(([at, , low95, , , high95]) => [at, low95, high95] as const),
          deep.co2.fit.map(([at, , , low68, high68]) => [at, low68, high68] as const),
        ],
        line: deep.co2.fit.map(([at, best]) => [at, best] as const),
        dots: picked.dots,
        key: picked.key,
        reference: PREINDUSTRIAL_CO2,
      },
      oldest,
      ma,
    );
    deepCharts.o2.render(
      {
        bands: [deep.o2.points.map(([at, , low, high]) => [at, low, high] as const)],
        line: deep.o2.points.map(([at, best]) => [at, best] as const),
        dots: [],
        reference: O2_TODAY,
      },
      oldest,
      ma,
    );
    airNote.replaceChildren(
      airWhy,
      ' ',
      element(
        'p',
        { 'data-testid': 'deep-co2' },
        `${co2Text(deep, ma)} `,
        element('a', { href: `https://doi.org/${deep.co2.doi}` }, 'Foster, Royer & Lunt 2017'),
      ),
      co2Picker,
      archiveNote,
      deepCharts.co2.root,
      element(
        'p',
        { 'data-testid': 'deep-o2' },
        `${o2Text(deep, ma)} `,
        element('a', { href: `https://doi.org/${deep.o2.doi}` }, 'Mills et al. 2023'),
      ),
      deepCharts.o2.root,
      element(
        'p',
        { 'data-testid': 'deep-n2' },
        `${NITROGEN_NOTE.text} `,
        ...NITROGEN_NOTE.sources.flatMap(({ label, doi }, index) => [
          ...(index === 0 ? [] : [' · ']),
          element('a', { href: `https://doi.org/${doi}` }, label),
        ]),
      ),
      element(
        'p',
        {},
        'Shaded: the likely and possible range (CO₂, on a log scale, 100–6,000 ppm), or the range of the methods combined (O₂, 0–45%); dots: single CO₂ estimates; dashed: the 1750 level of CO₂, and today’s O₂.',
      ),
    );
  }

  function renderAir(air: DeepTimeView['air'], scale: DeepScale, oldest: number, ma: number): void {
    airNote.hidden = !air.on;
    if (!air.on) return;
    if (scale !== 'ice') {
      renderDeepAir(air.deep, air.archive, oldest, ma);
      return;
    }
    const oldestKa = oldest * 1000;
    const ka = ma * 1000;
    if (air.atmosphere === null) {
      airNote.replaceChildren(airWhy, ' ', element('p', {}, 'Air: loading…'));
      return;
    }
    airNote.replaceChildren(
      airWhy,
      ' ',
      ...air.atmosphere.gases.flatMap((gas) => {
        const chart = gasCharts[gas.id];
        chart.render(gas, oldestKa, ka);
        return [
          element(
            'p',
            { 'data-testid': `gas-${gas.id}` },
            `${gasText(gas, ka)} `,
            element('a', { href: `https://doi.org/${gas.doi}` }, gas.credit),
          ),
          chart.root,
        ];
      }),
      element('p', {}, 'Dashed: the 1750 level. From air trapped in Antarctic ice.'),
    );
  }

  let current: DeepTimeView | null = null;
  // The span the ticks were placed for.
  let marksSpan = 0;
  // Slider units per million years, and the step, for the scale shown.
  const unit = (): number => (current?.scale === 'ice' ? 1000 : 1);
  const step = (): number =>
    current?.scale === 'ice' ? ICE_STEP_MA : current?.scale === 'eons' ? EONS_STEP_MA : STEP_MA;
  slider.addEventListener('input', () => {
    handlers.onMa(-Number(slider.value) / unit(), false);
  });
  older.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.min(current.oldest, current.ma + step()), true);
  });
  younger.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.max(0, current.ma - step()), true);
  });
  modelPicker.addEventListener('change', () => {
    const model = TEMPERATURE_MODELS.find((option) => option === modelPicker.value);
    if (model !== undefined) handlers.onTemperatureModel(model);
  });
  sketchPickers.impact.addEventListener('change', () => {
    const impact = IMPACT_MODELS.find((option) => option === sketchPickers.impact.value);
    if (impact !== undefined) handlers.onSketch({ impact });
  });
  sketchPickers.land.addEventListener('change', () => {
    const land = LAND_MODELS.find((option) => option === sketchPickers.land.value);
    if (land !== undefined) handlers.onSketch({ land });
  });
  sketchPickers.snowball.addEventListener('change', () => {
    const snowball = SNOWBALL_MODELS.find((option) => option === sketchPickers.snowball.value);
    if (snowball !== undefined) handlers.onSketch({ snowball });
  });
  seaIcePicker.addEventListener('change', () => {
    const model = SEA_ICE_MODELS.find((option) => option === seaIcePicker.value);
    if (model !== undefined) handlers.onSeaIce(model);
  });
  coastPicker.addEventListener('change', () => {
    const source = COAST_SOURCES.find((option) => option === coastPicker.value);
    if (source !== undefined) handlers.onCoast(source);
  });
  play.addEventListener('click', () => {
    handlers.onPlay(!(current?.playing ?? false));
  });
  airButton.addEventListener('click', () => {
    handlers.onAir(!(current?.air.on ?? false));
  });
  impactsButton.addEventListener('click', () => {
    handlers.onImpacts(!(current?.impacts.on ?? false));
  });
  platesButton.addEventListener('click', () => {
    handlers.onPlates(!(current?.plates ?? false));
  });
  seaLevelButton.addEventListener('click', () => {
    handlers.onSeaLevel(!(current?.seaLevel.on ?? false));
  });
  temperatureButton.addEventListener('click', () => {
    handlers.onTemperature(!(current?.temperature.on ?? false));
  });

  const bar: DeepTimeBar = {
    root,
    render(view) {
      current = view;
      root.hidden = view === null;
      if (view === null) return;
      if (marksSpan !== view.oldest) {
        marksSpan = view.oldest;
        marks.replaceChildren(
          ...MILESTONES.filter((milestone) => anchorMa(milestone) <= view.oldest).map(
            (milestone) => {
              const mark = element('span', {
                class: `deep-mark milestone-${milestone.kind}`,
                title: milestone.title,
              });
              mark.style.left = `${String((1 - anchorMa(milestone) / view.oldest) * 100)}%`;
              return mark;
            },
          ),
        );
      }
      bands.render({ oldest: view.oldest, ma: view.ma, playing: view.playing });
      polarityStrip.render(polaritySpans(view.polarity, view.oldest), view.oldest);
      const ice = view.scale === 'ice';
      const perMa = ice ? 1000 : 1;
      const uncharted = view.ma > view.mapsReach;
      const sketched = view.sketch !== null && view.sketch.sketch.questions.length > 0;
      unchartedNote.hidden = !uncharted || sketched;
      sketchNote.hidden = !sketched;
      sketchSources.hidden = !sketched;
      if (view.sketch !== null) {
        const { sketch, choices } = view.sketch;
        sketchHead.textContent = sketchHeadline(sketch);
        sketchWords.replaceChildren(
          ...sketchLines(sketch, choices, view.ma).map((line) => element('p', {}, line)),
        );
        for (const question of SKETCH_QUESTIONS) {
          sketchRows[question].hidden = !sketch.questions.includes(question);
          sketchPickers[question].value = choices[question];
        }
      }
      iceNote.hidden = !ice;
      iceLine.textContent = iceText(view.ice);
      motionLine.hidden = view.plateMotion === null;
      motionLine.textContent = view.plateMotion ?? '';
      const outlines = iceOutlineText(view.iceOutlines);
      outlineLine.hidden = outlines === null;
      outlineLine.textContent = outlines ?? '';
      if (view.seaIce !== null) {
        seaIceWords.textContent = seaIceText(view.seaIce);
        seaIcePicker.value = view.seaIce.model;
      }
      coastNote.hidden = view.coastline === null;
      if (view.coastline !== null) {
        coastText.textContent = coastlineText(view.coastline);
        coastPicker.value = view.coastline.coast;
      }
      slider.min = String(-view.oldest * perMa);
      slider.setAttribute('aria-label', ice ? 'Thousands of years ago' : 'Millions of years ago');
      if (document.activeElement !== slider) slider.value = String(-view.ma * perMa);
      const stepWords = ice
        ? '5,000 years'
        : `${String(view.scale === 'eons' ? EONS_STEP_MA : STEP_MA)} million years`;
      older.setAttribute('aria-label', `${stepWords} earlier`);
      younger.setAttribute('aria-label', `${stepWords} later`);
      // The temperature maps are 5 million years apart: nothing to show between ice ages.
      temperatureButton.disabled = ice || uncharted;
      slider.setAttribute('aria-valuetext', formatMa(view.ma));
      when.textContent = formatMa(view.ma);
      period.textContent = view.period === null ? '' : periodShort(view.period);
      facts.replaceChildren(
        ...earthFacts(view.ma, view.polarity).flatMap(({ label, text }) => [
          element('dt', {}, label),
          element('dd', {}, text),
        ]),
      );
      milestones.render(view.ma, view.oldest);
      seaLevelButton.setAttribute('aria-pressed', String(view.seaLevel.on));
      platesButton.setAttribute('aria-pressed', String(view.plates));
      // The maps of the 540 Myr and 4.6 Gyr spans are reconstructions; the ice ages', today's land.
      evidenceButton.hidden = view.scale === 'ice';
      featureChips.render(view.chips);
      // Impacts are placed on the elevation maps' reconstruction: not before them.
      impactsButton.hidden = view.scale === 'eons';
      impactsButton.setAttribute('aria-pressed', String(view.impacts.on));
      impactsNote.hidden = !view.impacts.on;
      if (view.impacts.on) {
        impactsMode.value = view.impacts.mode;
        impactsNote.replaceChildren(
          impactsWhy,
          ' ',
          impactsPicker,
          ' ',
          view.impacts.text ?? 'Impacts: loading…',
          ' Source: ',
          element('a', { href: 'https://impact.uwo.ca' }, 'the Impact Earth Database'),
          '; places then from the PALEOMAP model by the ',
          element('a', { href: 'https://gws.gplates.org' }, 'GPlates Web Service'),
          '.',
        );
      }
      // The ice cores on the ice-age scale; the proxies' 540 million years on that one.
      airButton.hidden = view.scale === 'eons';
      airButton.setAttribute('aria-pressed', String(view.air.on));
      renderAir(view.air, view.scale, view.oldest, view.ma);
      platesNote.hidden = !view.plates;
      platesWords.textContent = view.platesText ?? 'Loading the continent outlines…';
      seaLevel.render(
        view.seaLevel.on ? view.seaLevel.index : null,
        view.ma * 1000,
        view.oldest * 1000,
      );
      const { temperature } = view;
      temperatureButton.setAttribute('aria-pressed', String(temperature.on));
      legend.hidden = !temperature.on;
      legendMean.textContent = temperatureText(temperature);
      legendMap.textContent = temperatureMapText(temperature);
      modelPicker.value = temperature.wanted;
      legendNote.hidden = temperature.note === null;
      legendNote.textContent = temperature.note ?? '';
      play.textContent = view.playing ? '❚❚' : '▶';
      play.setAttribute('aria-label', view.playing ? 'Pause' : 'Play');
      if (speedsOf !== view.scale) {
        speedsOf = view.scale;
        speed.replaceChildren(
          ...DEEP_SPEEDS[view.scale].map((each) =>
            element('option', { value: String(each) }, deepSpeedText(each)),
          ),
        );
      }
      speed.value = String(view.speed);
      speed.title = `Speed: ${deepSpeedWords(view.speed)}`;
    },
  };
  return bar;
}
