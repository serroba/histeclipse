/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present; 44 px targets.
 */

import { MAP_KEY, MILESTONE_KEY } from '../deepTime/colourKey';
import { earthFacts } from '../deepTime/earthFacts';
import { type Period, periodShort } from '../deepTime/periods';
import { formatMa } from '../time/format';
import type { PolarityScale } from '../data/polarity';
import type { SeaIceModel } from '../data/seaIce';
import type { CoastSource } from '../deepTime/coastline';
import {
  type CoastlineView,
  type IceView,
  notesShown,
  type SeaIceView,
  sliderUnit,
  STEP_MA,
  stepped,
  stepWords,
} from './deepBarModel';
import type { TemperatureModel, TemperatureShow } from '../deepTime/temperatureModels';
import type { Sketch, SketchChoices } from '../deepTime/sketch';
import { DEEP_SPEEDS, deepSpeedText, deepSpeedWords } from '../deepTime/playSpeed';
import type { DeepScale, Layer } from '../state/viewState';
import type { WhyId } from '../sources/registry';
import { element } from './dom';
import { createTransport } from './transport';
import type { IceOutlines } from '../data/iceOutlines';
import type { StoryDate } from '../deepTime/storyDate';
import type { TemperatureView } from './temperatureLegend';
import { createDeepChips, type DeepChip, type DeepChipView } from './deepChips';
import { bookIcon } from './icons';
import { createMilestoneMarks } from './milestoneMarks';
import { createMilestonePanel } from './milestonePanel';
import { createPeriodBands } from './periodBands';
import { createPolarityStrip } from './polarityStrip';
import { attachFoldingSheet } from './foldingSheet';
import {
  type AirView,
  createAirChip,
  createSeaLevelChip,
  createTemperatureChip,
  type SeaLevelView,
} from './deepBarChips';
import { createDeepIceNotes } from './deepIceNotes';
import { createDeepSketchNote } from './deepSketchNote';
import { layerDock, type DockView } from './layerDock';
import './deepTimeBar.css';

export interface DeepTimeView extends DockView {
  readonly ma: number;
  /** A story's own date for the moment, while it has the globe (#492); null for the bar's. */
  readonly story: StoryDate | null;
  /** The bar's oldest and youngest moments, Ma: the span's, or a part of it (#1074). */
  readonly oldest: number;
  readonly youngest: number;
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
  /** The air: off, or on with the ice-core (ice ages) or 540 Myr gases, null while loading. */
  readonly air: AirView;
  /** The features' chips (#380, #605), by layer: offered here or not, on or not, and a note. */
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
  readonly seaLevel: SeaLevelView;
  /** Before the reconstructions: the hypotheses sketched, and whose; null where a map reaches. */
  readonly sketch: { readonly sketch: Sketch; readonly choices: SketchChoices } | null;
}

export interface DeepTimeBar {
  readonly root: HTMLElement;
  /** The layers whose buttons the dock shows now (#1072), drawn first: none while it is hidden. */
  docked(): ReadonlySet<string>;
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
  // The slider's value is minus the time ago, so dragging right moves towards the present: in
  // millions of years, or thousands on the ice-age scale. Its keys are all players' (`transport.ts`).
  const transport = createTransport(
    {
      play: { className: 'step deep-play' },
      slider: {
        class: 'deep-slider',
        max: '0',
        'aria-label': 'Millions of years ago',
      },
    },
    {
      onPlay(play) {
        handlers.onPlay(play);
      },
      onSlide(value) {
        handlers.onMa(-value / sliderUnit(current?.scale), false);
      },
    },
  );
  const { play, slider } = transport;
  let current: DeepTimeView | null = null;
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
  const unchartedNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'uncharted-note' },
    'No map: before 540 million years ago no surface map reaches. The Plates layer fills in one reconstruction’s continents back to 1,800 million years. Before that, and for snowball ice, the globe sketches what competing hypotheses say; pick whose below.',
  );
  const sketch = createDeepSketchNote((choice) => {
    handlers.onSketch(choice);
  });
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
  const iceNotes = createDeepIceNotes({
    iceWhy,
    coastWhy,
    onSeaIce: (model) => {
      handlers.onSeaIce(model);
    },
    onCoast: (coast) => {
      handlers.onCoast(coast);
    },
  });
  const when = element('strong', { class: 'deep-when', 'data-testid': 'deep-when' });
  const period = element('span', { class: 'deep-period', 'data-testid': 'deep-period' });
  // The bar's own chips (#605): each a button and a live note, made in deepBarChips.ts.
  const air = createAirChip(airWhy, {
    onAir: (on) => {
      handlers.onAir(on);
    },
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
  const seaLevel = createSeaLevelChip({
    onSeaLevel: (on) => {
      handlers.onSeaLevel(on);
    },
    onKa: (ka) => {
      handlers.onMa(ka / 1000, true);
    },
  });
  const temperature = createTemperatureChip(temperatureWhy, {
    onTemperature: (on) => {
      handlers.onTemperature(on);
    },
    onModel: (model) => {
      handlers.onTemperatureModel(model);
    },
    onShow: (show) => {
      handlers.onTemperatureShow(show);
    },
  });
  const dock = layerDock(seaLevel.button, temperature.button, ...featureChips.buttons, air.button);
  const swatch = (background: string) => {
    const box = element('span', { class: 'colour-swatch', 'aria-hidden': 'true' });
    box.style.background = background;
    return box;
  };
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
  const marks = createMilestoneMarks();
  const bands = createPeriodBands((ma) => {
    handlers.onMa(ma, true);
  });
  const polarityStrip = createPolarityStrip();
  const track = element(
    'div',
    { class: 'deep-track' },
    seaLevel.chart,
    slider,
    marks.root,
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
    iceNotes.ice,
    unchartedNote,
    sketch.note,
    iceNotes.coast,
    seaLevel.legend,
    temperature.legend,
    ...featureChips.notes,
    air.note,
    milestones.root,
    // One open at a time (they share a name), so the bar doesn't grow over the globe.
    element('div', { class: 'deep-folds' }, colourKey, sketch.sources, factsPanel),
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
      dock.root,
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

  transport.join(root);
  // The span the ticks were placed for.
  older.addEventListener('click', () => {
    if (current !== null)
      handlers.onMa(
        stepped(current.ma, current.oldest, current.scale, true, current.youngest),
        true,
      );
  });
  younger.addEventListener('click', () => {
    if (current !== null)
      handlers.onMa(
        stepped(current.ma, current.oldest, current.scale, false, current.youngest),
        true,
      );
  });

  const bar: DeepTimeBar = {
    root,
    docked: () => (root.hidden === false ? dock.shown() : new Set()),
    render(view) {
      current = view;
      root.hidden = view === null;
      if (view === null) return;
      marks.render(view.oldest, view.youngest);
      const { oldest, youngest } = view;
      bands.render({ oldest, youngest, ma: view.ma, playing: view.playing });
      polarityStrip.render(view.polarity, oldest, youngest);
      const shown = notesShown({
        ma: view.ma,
        mapsReach: view.mapsReach,
        scale: view.scale,
        sketchQuestions: view.sketch?.sketch.questions.length ?? null,
      });
      const { ice, uncharted } = shown;
      const perMa = sliderUnit(view.scale);
      unchartedNote.hidden = !shown.noMap;
      sketch.render(shown.sketch, view.sketch, view.ma);
      iceNotes.render(ice, view);
      slider.min = String(-oldest * perMa);
      slider.max = String(-youngest * perMa);
      slider.setAttribute('aria-label', ice ? 'Thousands of years ago' : 'Millions of years ago');
      transport.render(view.playing, -view.ma * perMa);
      const step = stepWords(view.scale);
      older.setAttribute('aria-label', `${step} earlier`);
      younger.setAttribute('aria-label', `${step} later`);
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
      milestones.render(view.ma, oldest, youngest);
      // The maps of the 540 Myr and 4.6 Gyr spans are reconstructions; the ice ages', today's land.
      evidenceButton.hidden = view.scale === 'ice';
      featureChips.render(view.chips);
      dock.render(view.active);
      air.render(view.air, view.scale, oldest, view.ma, youngest);
      seaLevel.render(view.seaLevel, view.ma, oldest, youngest);
      temperature.render(view.temperature, uncharted);
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
