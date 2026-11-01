/**
 * The bottom bar in deep time: drag through 540 million years (oldest on the left, so time runs
 * left to right), step 5 million years at a time, or play towards the present.
 * Mobile first: 44 px targets, like the year bar it replaces.
 */

import { earthFacts } from '../deepTime/earthFacts';
import { anchorMa, MILESTONES } from '../deepTime/milestones';
import { formatMa, type Period, periodShort } from '../deepTime/periods';
import type { SeaLevelIndex } from '../data/seaLevel';
import { COAST_SOURCES, type CoastSource } from '../deepTime/coastline';
import {
  TEMPERATURE_MODEL_LABELS,
  TEMPERATURE_MODELS,
  type TemperatureModel,
} from '../deepTime/temperatureModels';
import type { DeepScale } from '../state/viewState';
import { element } from './dom';
import { createMilestonePanel } from './milestonePanel';
import { createSeaLevelChart } from './seaLevelChart';

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

/** What the bar says about the ice sheets on the ice-age scale. */
export function iceText(view: {
  readonly drawn: boolean;
  readonly oldestKa: number | null;
}): string {
  if (view.oldestKa === null) return 'Ice sheets: loading…';
  const reach = `${(view.oldestKa * 1000).toLocaleString('en')} years`;
  return view.drawn
    ? `Ice sheets: PaleoMIST 1.0 (Gowan et al. 2021), every 2,500 years over the last ${reach}.`
    : `Ice sheets: no openly licensed maps reach back beyond ${reach}; sea level and the bared shelves still show each glacial cycle.`;
}

export interface DeepTimeView {
  readonly ma: number;
  /** The oldest moment the maps reach, Ma. */
  readonly oldest: number;
  readonly period: Period | null;
  readonly playing: boolean;
  /** The span shown; `oldest` is its start. */
  readonly scale: DeepScale;
  /** How far back the elevation maps reach, Ma; before it the globe is blank. */
  readonly mapsReach: number;
  readonly temperature: TemperatureView;
  /** Whether a second reconstruction's continents are outlined, and what to say of them. */
  readonly plates: boolean;
  readonly platesText: string | null;
  /** The ice-age coastline; null before the ice ages. */
  readonly coastline: CoastlineView | null;
  /** Whether ice is drawn at the moment shown, and how far back the ice maps reach (ka). */
  readonly ice: { readonly drawn: boolean; readonly oldestKa: number | null };
  /** Sea level: off, on while the reconstructions load (null), or on with them. */
  readonly seaLevel:
    { readonly on: false } | { readonly on: true; readonly index: SeaLevelIndex | null };
}

export interface DeepTimeBar {
  readonly root: HTMLElement;
  render(view: DeepTimeView | null): void;
}

export function createDeepTimeBar(handlers: {
  onMa(ma: number): void;
  onPlay(playing: boolean): void;
  onExit(): void;
  onTemperature(on: boolean): void;
  onSeaLevel(on: boolean): void;
  onPlates(on: boolean): void;
  onScale(scale: DeepScale): void;
  onCoast(coast: CoastSource): void;
  onTemperatureModel(model: TemperatureModel): void;
}): DeepTimeBar {
  const play = element(
    'button',
    { type: 'button', class: 'step deep-play', 'aria-label': 'Play' },
    '▶',
  );
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
  const scaleAll = element(
    'button',
    { type: 'button', class: 'deep-scale-option', 'aria-pressed': 'true' },
    '540 Myr',
  );
  const scaleIce = element(
    'button',
    { type: 'button', class: 'deep-scale-option', 'aria-pressed': 'false' },
    'Ice ages',
  );
  const scaleEons = element(
    'button',
    { type: 'button', class: 'deep-scale-option', 'aria-pressed': 'false' },
    '4.6 Gyr',
  );
  const scaleSwitch = element(
    'span',
    { class: 'deep-scale', role: 'group', 'aria-label': 'Time span' },
    scaleIce,
    scaleAll,
    scaleEons,
  );
  const unchartedNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'uncharted-note' },
    'No map: before 540 million years ago the continents’ positions are too uncertain to draw here, so the globe is left blank. The milestones tell what was happening.',
  );
  const coastText = element('span', { 'data-testid': 'coastline' });
  const iceLine = element('p', { 'data-testid': 'ice-sheets' });
  const coastPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Coastline follows' },
    ...COAST_SOURCES.map((source) => element('option', { value: source }, COAST_LABELS[source])),
  );
  const iceNote = element(
    'div',
    { class: 'deep-note', hidden: '', 'data-testid': 'ice-note' },
    element(
      'p',
      {},
      'The last 2.6 million years: today’s land and sea floor, with the coast drawn at the sea level of the time; bared shelf is sandy. The small moves of the continents are not drawn, and the temperature maps are 5 million years apart.',
    ),
    iceLine,
  );
  const coastNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'coast-note' },
    coastText,
    ' ',
    element('label', {}, 'Follow ', coastPicker),
    ' Drawn on NOAA’s present-day depths (ETOPO1); each source is measured from its own present day.',
  );
  const when = element('strong', { class: 'deep-when', 'data-testid': 'deep-when' });
  const period = element('span', { class: 'deep-period', 'data-testid': 'deep-period' });
  const exit = element('button', { type: 'button', class: 'deep-exit' }, 'Back to history');
  const platesButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false' },
    'Plates',
  );
  const platesWords = element('span', {});
  const platesNote = element(
    'p',
    { class: 'deep-note', hidden: '', 'data-testid': 'plates-note' },
    element('span', { class: 'plates-swatch', 'aria-hidden': 'true' }),
    ' ',
    platesWords,
  );
  const seaLevelButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false' },
    'Sea level',
  );
  const seaLevel = createSeaLevelChart({
    onKa(ka) {
      handlers.onMa(ka / 1000);
    },
  });
  const temperatureButton = element(
    'button',
    { type: 'button', class: 'deep-layer', 'aria-pressed': 'false' },
    'Temperature',
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
  const legend = element(
    'div',
    { class: 'temperature-legend', hidden: '' },
    element(
      'div',
      { class: 'temperature-scale-row' },
      element('span', {}, '−40 °C'),
      legendScale,
      element('span', {}, '45 °C'),
    ),
    element('p', {}, legendMean),
    element('p', {}, legendMap, ' ', element('label', {}, 'Colour by ', modelPicker)),
    legendNote,
  );
  // Poles, field, tilt and day: folded away, so the bar stays small on a phone.
  const facts = element('dl', { class: 'deep-facts-list' });
  const factsPanel = element(
    'details',
    { class: 'deep-facts', 'data-testid': 'deep-facts' },
    element('summary', {}, 'Poles, magnetic field, tilt and day'),
    facts,
  );
  // A tick on the track for each milestone, placed when the time line's span is known.
  const marks = element('div', { class: 'deep-marks', 'aria-hidden': 'true' });
  const track = element('div', { class: 'deep-track' }, seaLevel.chart, slider, marks);
  const milestones = createMilestonePanel({
    onMa(ma) {
      handlers.onMa(ma);
    },
  });
  const root = element(
    'nav',
    { class: 'deep-time', 'aria-label': 'Deep time', hidden: '' },
    element('div', { class: 'deep-controls' }, play, older, track, younger),
    element(
      'p',
      { class: 'deep-label' },
      when,
      ' ',
      period,
      scaleSwitch,
      seaLevelButton,
      temperatureButton,
      platesButton,
      exit,
    ),
    iceNote,
    unchartedNote,
    coastNote,
    seaLevel.legend,
    legend,
    platesNote,
    milestones.root,
    factsPanel,
  );

  let current: DeepTimeView | null = null;
  // The span the ticks were placed for.
  let marksSpan = 0;
  // Slider units per million years, and the step, for the scale shown.
  const unit = (): number => (current?.scale === 'ice' ? 1000 : 1);
  const step = (): number =>
    current?.scale === 'ice' ? ICE_STEP_MA : current?.scale === 'eons' ? EONS_STEP_MA : STEP_MA;
  slider.addEventListener('input', () => {
    handlers.onMa(-Number(slider.value) / unit());
  });
  older.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.min(current.oldest, current.ma + step()));
  });
  younger.addEventListener('click', () => {
    if (current !== null) handlers.onMa(Math.max(0, current.ma - step()));
  });
  scaleAll.addEventListener('click', () => {
    handlers.onScale('all');
  });
  scaleIce.addEventListener('click', () => {
    handlers.onScale('ice');
  });
  modelPicker.addEventListener('change', () => {
    const model = TEMPERATURE_MODELS.find((option) => option === modelPicker.value);
    if (model !== undefined) handlers.onTemperatureModel(model);
  });
  scaleEons.addEventListener('click', () => {
    handlers.onScale('eons');
  });
  coastPicker.addEventListener('change', () => {
    const source = COAST_SOURCES.find((option) => option === coastPicker.value);
    if (source !== undefined) handlers.onCoast(source);
  });
  play.addEventListener('click', () => {
    handlers.onPlay(!(current?.playing ?? false));
  });
  exit.addEventListener('click', () => {
    handlers.onExit();
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

  return {
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
      const ice = view.scale === 'ice';
      const perMa = ice ? 1000 : 1;
      scaleAll.setAttribute('aria-pressed', String(view.scale === 'all'));
      scaleIce.setAttribute('aria-pressed', String(ice));
      scaleEons.setAttribute('aria-pressed', String(view.scale === 'eons'));
      const uncharted = view.ma > view.mapsReach;
      unchartedNote.hidden = !uncharted;
      iceNote.hidden = !ice;
      iceLine.textContent = iceText(view.ice);
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
        ...earthFacts(view.ma).flatMap(({ label, text }) => [
          element('dt', {}, label),
          element('dd', {}, text),
        ]),
      );
      milestones.render(view.ma, view.oldest);
      seaLevelButton.setAttribute('aria-pressed', String(view.seaLevel.on));
      platesButton.setAttribute('aria-pressed', String(view.plates));
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
    },
  };
}
