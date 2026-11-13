/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present; 44 px targets.
 */

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { earthFacts } from '../deepTime/earthFacts';
import { polaritySpans } from '../deepTime/earthState';
import { type Period, periodShort } from '../deepTime/periods';
import { formatMa } from '../time/format';
import type { Atmosphere } from '../data/atmosphere';
import type { DeepAir } from '../data/deepAir';
import type { Co2Archive } from '../data/co2Archive';
import type { PolarityScale } from '../data/polarity';
import { SEA_ICE_MODELS, type SeaIceModel } from '../data/seaIce';
import type { SeaLevelIndex } from '../data/seaLevel';
import { COAST_SOURCES, type CoastSource } from '../deepTime/coastline';
import {
  COAST_LABELS,
  coastlineText,
  type CoastlineView,
  iceText,
  type IceView,
  milestoneTicks,
  notesShown,
  SEA_ICE_LABELS,
  seaIceText,
  type SeaIceView,
  sliderUnit,
  STEP_MA,
  stepped,
  stepWords,
} from './deepBarModel';
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
  /**
   * The chips (#380, #605), by layer: the features', the plates' and the impacts'; whether each
   * is offered and on, and its note.
   */
  readonly chips: ReadonlyMap<Layer, DeepChipView>;
  /** The ice-age coastline; null before the ice ages. */
  readonly coastline: CoastlineView | null;
  /** The sea ice; null off the ice-age scale. */
  readonly seaIce: SeaIceView | null;
  /** The ice sheets on the ice-age scale. */
  readonly ice: IceView;
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
    /** A chip pressed: its layer on or off. */
    onLayer(layer: Layer, on: boolean): void;
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
  const temperatureWhy = handlers.why('temperature', 'Temperature');
  const factsWhy = handlers.why('earth-facts', 'Poles, magnetic field, tilt, day and Sun');
  const airWhy = handlers.why('air', 'Air');
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
  // The chips (#380, #605): the plates', the features', the impacts'; each a button and a note.
  const featureChips = createDeepChips(
    chips,
    (id, label) => handlers.why(id, label),
    (layer, on) => {
      handlers.onLayer(layer, on);
    },
  );
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
    ...featureChips.notes,
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
      ...featureChips.buttons,
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
  slider.addEventListener('input', () => {
    handlers.onMa(-Number(slider.value) / sliderUnit(current?.scale), false);
  });
  older.addEventListener('click', () => {
    if (current !== null)
      handlers.onMa(stepped(current.ma, current.oldest, current.scale, true), true);
  });
  younger.addEventListener('click', () => {
    if (current !== null)
      handlers.onMa(stepped(current.ma, current.oldest, current.scale, false), true);
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
          ...milestoneTicks(view.oldest).map(({ kind, title, left }) => {
            const mark = element('span', { class: `deep-mark milestone-${kind}`, title });
            mark.style.left = `${String(left)}%`;
            return mark;
          }),
        );
      }
      bands.render({ oldest: view.oldest, ma: view.ma, playing: view.playing });
      polarityStrip.render(polaritySpans(view.polarity, view.oldest), view.oldest);
      const shown = notesShown({
        ma: view.ma,
        mapsReach: view.mapsReach,
        scale: view.scale,
        sketchQuestions: view.sketch?.sketch.questions.length ?? null,
      });
      const { ice, uncharted } = shown;
      const perMa = sliderUnit(view.scale);
      unchartedNote.hidden = !shown.noMap;
      sketchNote.hidden = !shown.sketch;
      sketchSources.hidden = !shown.sketch;
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
      const step = stepWords(view.scale);
      older.setAttribute('aria-label', `${step} earlier`);
      younger.setAttribute('aria-label', `${step} later`);
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
      // The maps of the 540 Myr and 4.6 Gyr spans are reconstructions; the ice ages', today's land.
      evidenceButton.hidden = view.scale === 'ice';
      featureChips.render(view.chips);
      // The ice cores on the ice-age scale; the proxies' 540 million years on that one.
      airButton.hidden = view.scale === 'eons';
      airButton.setAttribute('aria-pressed', String(view.air.on));
      air.render(view.air, view.scale, view.oldest, view.ma);
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
