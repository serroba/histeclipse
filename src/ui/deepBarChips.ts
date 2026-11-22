/**
 * The deep-time bar's own chips (#605): Sea level, Temperature and Air, each a button for the
 * bar's row and the note it opens, made and drawn here rather than in the bar, which only places
 * them. Unlike the features' chips (`deepChips.ts`, notes as data), their notes are live: the
 * sea level's chart over the track and its legend, the temperature legend with its models, the
 * air's gas charts.
 */

import type { DeepScale, Layer } from '../state/viewState';
import type { DeepAir } from '../data/deepAir';
import type { Atmosphere } from '../data/atmosphere';
import type { Co2Archive } from '../data/co2Archive';
import type { SeaLevelIndex } from '../data/seaLevel';
import type { TemperatureModel, TemperatureShow } from '../deepTime/temperatureModels';
import { createDeepAirNote } from './deepAirNote';
import { element } from './dom';
import { layerIcon } from './icons';
import { createSeaLevelChart } from './seaLevelChart';
import { createTemperatureLegend, type TemperatureView } from './temperatureLegend';

/** A chip's button: its layer's icon and word, pressed while its layer is on. */
function chipButton(layer: Layer, label: string, hidden: boolean): HTMLButtonElement {
  return element(
    'button',
    {
      type: 'button',
      class: 'deep-layer',
      'data-layer': layer,
      'aria-pressed': 'false',
      title: label,
      ...(hidden ? { hidden: '' } : {}),
    },
    layerIcon(layer, 18),
    element('span', { class: 'icon-label' }, label),
  );
}

/** Sea level: off, on while the reconstructions load (null), or on with them. */
export type SeaLevelView =
  { readonly on: false } | { readonly on: true; readonly index: SeaLevelIndex | null };

export interface SeaLevelChip {
  readonly button: HTMLButtonElement;
  /** The chart, over the slider. */
  readonly chart: HTMLElement;
  /** The legend, among the bar's notes. */
  readonly legend: HTMLElement;
  /** The bar shows `oldest` to `youngest` Ma: today unless a part of its span (#1074). */
  render(view: SeaLevelView, ma: number, oldest: number, youngest?: number): void;
}

export function createSeaLevelChip(handlers: {
  onSeaLevel(on: boolean): void;
  /** A moment picked on the chart, thousands of years ago. */
  onKa(ka: number): void;
}): SeaLevelChip {
  const button = chipButton('sealevel', 'Sea level', false);
  const chart = createSeaLevelChart({
    onKa: (ka) => {
      handlers.onKa(ka);
    },
  });
  let on = false;
  button.addEventListener('click', () => {
    handlers.onSeaLevel(!on);
  });
  return {
    button,
    chart: chart.chart,
    legend: chart.legend,
    render(view, ma, oldest, youngest = 0) {
      on = view.on;
      button.setAttribute('aria-pressed', String(view.on));
      chart.render(view.on ? view.index : null, ma * 1000, oldest * 1000, youngest * 1000);
    },
  };
}

export interface TemperatureChip {
  readonly button: HTMLButtonElement;
  readonly legend: HTMLElement;
  /** `uncharted`: before the maps, where no temperature map draws. */
  render(view: TemperatureView, uncharted: boolean): void;
}

export function createTemperatureChip(
  why: HTMLElement,
  handlers: {
    onTemperature(on: boolean): void;
    onModel(model: TemperatureModel): void;
    onShow(show: TemperatureShow): void;
  },
): TemperatureChip {
  const button = chipButton('temperature', 'Temperature', false);
  const legend = createTemperatureLegend(why, {
    onModel: (model) => {
      handlers.onModel(model);
    },
    onShow: (show) => {
      handlers.onShow(show);
    },
  });
  let on = false;
  button.addEventListener('click', () => {
    handlers.onTemperature(!on);
  });
  return {
    button,
    legend: legend.root,
    render(view, uncharted) {
      on = view.on;
      // On the ice-age scale only the ice ages' own maps draw (#457); before the maps, none.
      button.disabled = uncharted;
      button.setAttribute('aria-pressed', String(view.on));
      legend.render(view);
    },
  };
}

/** The air at the moment: off, or on with what has loaded. */
export type AirView =
  | { readonly on: false }
  | {
      readonly on: true;
      readonly atmosphere: Atmosphere | null;
      readonly deep: DeepAir | null;
      readonly archive: Co2Archive | null;
    };

export interface AirChip {
  readonly button: HTMLButtonElement;
  readonly note: HTMLElement;
  render(view: AirView, scale: DeepScale, oldest: number, ma: number, youngest?: number): void;
}

export function createAirChip(
  why: HTMLElement,
  handlers: { onAir(on: boolean): void; onCo2Archive(): void; redraw(): void },
): AirChip {
  const button = chipButton('air', 'Air', true);
  const note = createDeepAirNote({
    why,
    onCo2Archive: () => {
      handlers.onCo2Archive();
    },
    redraw: () => {
      handlers.redraw();
    },
  });
  let on = false;
  button.addEventListener('click', () => {
    handlers.onAir(!on);
  });
  return {
    button,
    note: note.root,
    render(view, scale, oldest, ma, youngest = 0) {
      on = view.on;
      // The ice cores on the ice-age scale; the proxies' 540 million years on that one.
      button.hidden = scale === 'eons';
      button.setAttribute('aria-pressed', String(view.on));
      note.render(view, scale, oldest, ma, youngest);
    },
  };
}
