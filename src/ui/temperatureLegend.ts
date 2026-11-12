/**
 * The Temperature layer's legend in the deep-time bar: the colour scale the globe is drawn in,
 * each colour named, every model's mean then and now, which model colours the globe, and the
 * pickers for the model and for what the colours show (#457): the temperature itself, or, over
 * the last 800,000 years where the geography is today's, its change from today.
 */

import {
  TEMPERATURE_MODEL_LABELS,
  TEMPERATURE_MODELS,
  TEMPERATURE_SHOWS,
  type TemperatureModel,
  type TemperatureShow,
} from '../deepTime/temperatureModels';
import { element } from './dom';

/** One model's mean at the moment shown and today, °C; `mean` null beyond its reach. */
export interface TemperatureReading {
  readonly model: TemperatureModel;
  readonly mean: number | null;
  readonly today: number | null;
  /** How far back its maps reach, Ma. */
  readonly reach: number;
  /** What its mean is over: the whole globe, or ice-free land only. */
  readonly coverage: 'global' | 'land';
}

export interface TemperatureView {
  readonly on: boolean;
  /** The model asked for, and the one colouring the globe (null while the maps load). */
  readonly wanted: TemperatureModel;
  readonly shown: TemperatureModel | null;
  /** What the colours are asked to show, and whether the globe shows the change from today. */
  readonly show: TemperatureShow;
  readonly changing: boolean;
  /** Every model loaded so far, in a fixed order. */
  readonly readings: readonly TemperatureReading[];
  /** What the site says about the map shown, if anything. */
  readonly note: string | null;
}

type Stops = readonly (readonly [number, string])[];

/** The legend's stops, °C, matching the globe's shader. */
export const TEMPERATURE_STOPS: Stops = [
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

/** The change from today, °C, matching the shader: blue colder, red warmer, uncoloured near today. */
export const CHANGE_STOPS: Stops = [
  [-20, '#313695'],
  [-10, '#4575b4'],
  [-4, '#74add1'],
  [-1, '#abd9e9'],
  // Uncoloured: within about a degree of today the globe keeps its land's own colours.
  [0, 'transparent'],
  [1, '#fee090'],
  [4, '#fdae61'],
  [10, '#d73027'],
];

export const CHANGE_KEY: readonly { readonly celsius: number; readonly label: string }[] = [
  { celsius: -20, label: 'under an ice age’s cold' },
  { celsius: -10, label: 'much colder' },
  { celsius: -4, label: 'colder' },
  { celsius: 0, label: 'as today: not coloured' },
  { celsius: 4, label: 'warmer' },
  { celsius: 10, label: 'much warmer' },
];

/** The ticks under the scale: each temperature and how far along it is placed, 0 to 1. */
export function scaleTicks(
  stops: Stops,
  ticks: readonly number[],
): readonly { readonly celsius: number; readonly at: number }[] {
  const first = stops[0]?.[0] ?? 0;
  const last = stops.at(-1)?.[0] ?? 1;
  return ticks.map((celsius) => ({ celsius, at: (celsius - first) / (last - first) }));
}

/** "−40 °C", with a true minus sign; "+4 °C" for a change. */
export function celsiusText(celsius: number, signed = false): string {
  const sign = celsius < 0 ? '−' : signed && celsius > 0 ? '+' : '';
  return `${sign}${String(Math.abs(celsius))} °C`;
}

/** A CSS gradient through the stops, placed by temperature. */
export function legendGradient(stops: Stops): string {
  const first = stops[0]?.[0] ?? 0;
  const last = stops.at(-1)?.[0] ?? 1;
  const placed = stops.map(
    ([celsius, colour]) => `${colour} ${((100 * (celsius - first)) / (last - first)).toFixed(1)}%`,
  );
  return `linear-gradient(to right, ${placed.join(', ')})`;
}

/** "Mean: Krapp et al. 2021, land 4.1 °C (today 13.0 °C) · Scotese 2022 14.6 °C …". */
export function temperatureText(view: TemperatureView): string {
  if (view.readings.length === 0) return 'Loading temperature maps…';
  const each = view.readings.map(({ model, mean, today, reach, coverage }) => {
    const label = `${TEMPERATURE_MODEL_LABELS[model]}${coverage === 'land' ? ', land' : ''}`;
    if (mean === null) return `${label} — covers the last ${reachText(reach)}`;
    const now = today === null ? '' : ` (today ${today.toFixed(1)} °C)`;
    return `${label} ${mean.toFixed(1)} °C${now}`;
  });
  return `Mean: ${each.join(' · ')}`;
}

function reachText(ma: number): string {
  return ma < 1 ? `${(ma * 1000).toLocaleString('en')},000 years` : `${String(ma)} million years`;
}

const LIMITS: Readonly<Record<TemperatureModel, string>> = {
  krapp:
    ' A statistical emulator of 72 HadCM3 climate-model runs, driven by CO₂, Earth’s orbit and the ice sheets: land only, the ice sheets left blank.',
  scotese: ' A HadCM3L climate model adjusted to rock and isotope records.',
  cesm: ' Its grid is about 3.75° and its geography its own, so its warm and cold patches do not follow these coasts exactly.',
};

/** Which model colours the globe, any stand-in, its limits, and what the colours show. */
export function temperatureMapText(view: TemperatureView): string {
  if (view.shown === null) return '';
  const shown = TEMPERATURE_MODEL_LABELS[view.shown];
  const stand =
    view.shown === view.wanted
      ? ''
      : ` ${TEMPERATURE_MODEL_LABELS[view.wanted]} does not reach this far.`;
  const change = view.changing ? ' Coloured by the change from today’s map.' : '';
  return `The globe shows ${shown}.${stand}${LIMITS[view.shown]}${change}`;
}

const SHOW_LABELS: Readonly<Record<TemperatureShow, string>> = {
  change: 'change from today',
  actual: 'temperature',
};

function swatch(background: string): HTMLElement {
  const box = element('span', { class: 'colour-swatch', 'aria-hidden': 'true' });
  box.style.background = background;
  return box;
}

/** A scale: its gradient, its ticks under it, and each colour named. */
function scale(
  stops: Stops,
  ticks: readonly number[],
  key: readonly { readonly celsius: number; readonly label: string }[],
  signed: boolean,
  testId: string,
): HTMLElement {
  const bar = element('span', { class: 'temperature-scale', 'aria-hidden': 'true' });
  bar.style.background = legendGradient(stops);
  const first = stops[0]?.[0];
  const last = stops.at(-1)?.[0];
  return element(
    'div',
    { 'data-testid': testId },
    bar,
    element(
      'div',
      { class: 'temperature-ticks', 'aria-hidden': 'true' },
      ...scaleTicks(stops, ticks).map(({ celsius, at }) => {
        const tick = element('span', {}, celsiusText(celsius, signed));
        tick.style.left = `${(at * 100).toFixed(1)}%`;
        return tick;
      }),
    ),
    element(
      'ul',
      { class: 'colour-key temperature-key' },
      ...key.map(({ celsius, label }) => {
        const colour = stops.find(([stop]) => stop === celsius)?.[1] ?? '#888';
        const beyond =
          celsius === first
            ? ' or colder'
            : celsius === last
              ? signed
                ? ' or warmer'
                : ' or hotter'
              : '';
        return element(
          'li',
          {},
          swatch(colour),
          `${celsiusText(celsius, signed)}${beyond}: ${label}`,
        );
      }),
    ),
  );
}

export interface TemperatureLegend {
  readonly root: HTMLElement;
  render(view: TemperatureView): void;
}

export function createTemperatureLegend(
  /** The book that says where the maps come from. */
  why: HTMLElement,
  handlers: {
    onModel(model: TemperatureModel): void;
    onShow(show: TemperatureShow): void;
  },
): TemperatureLegend {
  const heading = element('span', {});
  const actual = scale(
    TEMPERATURE_STOPS,
    [-40, -20, 0, 15, 30, 45],
    TEMPERATURE_KEY,
    false,
    'temperature-key',
  );
  const change = scale(CHANGE_STOPS, [-20, -10, 0, 10], CHANGE_KEY, true, 'temperature-change-key');
  const mean = element('span', { 'data-testid': 'temperature-mean' });
  const map = element('span', { 'data-testid': 'temperature-map' });
  const note = element('p', { class: 'temperature-note', hidden: '' });
  const modelPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Temperature model' },
    ...TEMPERATURE_MODELS.map((model) =>
      element('option', { value: model }, TEMPERATURE_MODEL_LABELS[model]),
    ),
  );
  const showPicker = element(
    'select',
    { class: 'deep-coast', 'aria-label': 'Colours show' },
    ...TEMPERATURE_SHOWS.map((show) => element('option', { value: show }, SHOW_LABELS[show])),
  );
  const showLabel = element('label', {}, ' Colours show ', showPicker);
  modelPicker.addEventListener('change', () => {
    const model = TEMPERATURE_MODELS.find((option) => option === modelPicker.value);
    if (model !== undefined) handlers.onModel(model);
  });
  showPicker.addEventListener('change', () => {
    const show = TEMPERATURE_SHOWS.find((option) => option === showPicker.value);
    if (show !== undefined) handlers.onShow(show);
  });
  const root = element(
    'div',
    { class: 'temperature-legend', hidden: '' },
    element('p', { class: 'temperature-heading' }, heading, ' ', why),
    actual,
    change,
    element('p', {}, mean),
    element('p', {}, map, ' ', element('label', {}, 'Colour by ', modelPicker), showLabel),
    note,
  );

  return {
    root,
    render(view) {
      root.hidden = !view.on;
      heading.textContent = view.changing
        ? 'Colours: how much warmer or colder than today, over a year'
        : 'Colours: the average temperature at the surface over a year';
      actual.hidden = view.changing;
      change.hidden = !view.changing;
      mean.textContent = temperatureText(view);
      map.textContent = temperatureMapText(view);
      modelPicker.value = view.wanted;
      showPicker.value = view.show;
      // Only where the geography is today's can a place be set beside itself today.
      showLabel.hidden = view.shown !== 'krapp';
      note.hidden = view.note === null;
      note.textContent = view.note ?? '';
    },
  };
}
