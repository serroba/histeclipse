/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present; 44 px targets.
 */

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { earthFacts } from '../deepTime/earthFacts';
import { polaritySpans } from '../deepTime/earthState';
import { anchorMa, MILESTONES } from '../deepTime/milestones';
import { type Period, periodShort } from '../deepTime/periods';
import { formatMa } from '../time/format';
import type { Atmosphere } from '../data/atmosphere';
import { IMPACTS_MODES, type ImpactsMode } from '../data/impacts';
import type { DeepAir } from '../data/deepAir';
import type { Co2Archive } from '../data/co2Archive';
import type { PolarityScale } from '../data/polarity';
import type { IceStandIn } from '../data/iceSheets';
import { SEA_ICE_MODELS, type SeaIceModel } from '../data/seaIce';
import type { SeaLevelIndex } from '../data/seaLevel';
import { COAST_SOURCES, type CoastSource } from '../deepTime/coastline';
import type { TemperatureModel, TemperatureShow } from '../deepTime/temperatureModels';
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
import type { IceOutlines } from '../data/iceOutlines';
import type { StoryDate } from '../deepTime/storyDate';
import { iceOutlineText } from './iceOutlineText';
import { createTemperatureLegend, type TemperatureView } from './temperatureLegend';
import { createDeepChips, type DeepChip, type DeepChipView } from './deepChips';
import { bookIcon, uiIcon } from './icons';
import { createMilestonePanel } from './milestonePanel';
import { createPeriodBands } from './periodBands';
import { createPolarityStrip } from './polarityStrip';
import { createSeaLevelChart } from './seaLevelChart';
import { attachFoldingSheet } from './foldingSheet';
import { createDeepAirNote } from './deepAirNote';
import './deepTimeBar.css';

/** Each step button moves by one elevation map, or on the ice-age scale by 5,000 years. */
const STEP_MA = 5;
const ICE_STEP_MA = 0.005;
/** Over all of Earth's history, a step is 50 million years. */
const EONS_STEP_MA = 50;

const COAST_LABELS: Readonly<Record<CoastSource, string>> = {
  'bintanja-2008': 'Bintanja & van de Wal 2008',
  'spratt-2016': 'Spratt & Lisiecki 2016',
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

const SEA_ICE_LABELS: Readonly<Record<SeaIceModel, string>> = {
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
    ? `Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last ${reach}, with today’s ice to the coast (Natural Earth).`
    : `Ice sheets: no openly licensed maps reach back beyond ${reach}; sea level and the bared shelves still show each glacial cycle.`;
}

export interface DeepTimeView {
  readonly ma: number;
  /** A story's own date for the moment, while it has the globe (#492); null for the bar's. */
  readonly story: StoryDate | null;
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
    onTemperatureShow(show: TemperatureShow): void;
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
      'The last 2.6 million years: today’s land and sea floor, with the coast drawn at the sea level of the time. Sea floor laid dry is sandy; ice sheets are white. The continents are drawn where they are today (how far they have moved is below), and the temperature maps, of land only, are 2,000 years apart.',
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
  const air = createDeepAirNote({
    why: airWhy,
    onCo2Archive: () => {
      handlers.onCo2Archive();
    },
    redraw: () => {
      if (current !== null) bar.render(current);
    },
  });
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
  const swatch = (background: string) => {
    const box = element('span', { class: 'colour-swatch', 'aria-hidden': 'true' });
    box.style.background = background;
    return box;
  };
  const legend = createTemperatureLegend(temperatureWhy, {
    onModel: (model) => {
      handlers.onTemperatureModel(model);
    },
    onShow: (show) => {
      handlers.onTemperatureShow(show);
    },
  });
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
    legend.root,
    platesNote,
    ...featureChips.notes,
    impactsNote,
    air.root,
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
  attachFoldingSheet({
    root,
    handle,
    details,
    storageKey: 'histeclipse.deepSheet',
    ignore: 'input, select, .deep-controls',
  });

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
      // On the ice-age scale only the ice ages' own maps draw (#457); before the maps, none.
      temperatureButton.disabled = uncharted;
      slider.setAttribute('aria-valuetext', formatMa(view.ma));
      when.textContent = view.story?.when ?? formatMa(view.ma);
      const named = view.period === null ? '' : periodShort(view.period);
      period.textContent = view.story?.what ?? named;
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
      air.render(view.air, view.scale, view.oldest, view.ma);
      platesNote.hidden = !view.plates;
      platesWords.textContent = view.platesText ?? 'Loading the continent outlines…';
      seaLevel.render(
        view.seaLevel.on ? view.seaLevel.index : null,
        view.ma * 1000,
        view.oldest * 1000,
      );
      const { temperature } = view;
      temperatureButton.setAttribute('aria-pressed', String(temperature.on));
      legend.render(temperature);
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
