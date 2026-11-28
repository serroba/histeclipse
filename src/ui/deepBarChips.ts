/**
 * The deep-time bar's own notes (#605): Sea level, Temperature and Air, made and drawn here rather
 * than in the bar, which only places them. Unlike the features' (`deepChips.ts`, notes as data),
 * they are live: the sea level's chart over the track and its legend, the temperature legend with
 * its models, the air's gas charts. Their layers are switched in Layers and its chips (#1137).
 */

import type { DeepScale } from '../state/viewState';
import type { DeepAir } from '../data/deepAir';
import type { Atmosphere } from '../data/atmosphere';
import type { Co2Archive } from '../data/co2Archive';
import type { SeaLevelIndex } from '../data/seaLevel';
import type { TemperatureModel, TemperatureShow } from '../deepTime/temperatureModels';
import { createDeepAirNote } from './deepAirNote';
import { createSeaLevelChart } from './seaLevelChart';
import { createTemperatureLegend, type TemperatureView } from './temperatureLegend';

/** Sea level: off, on while the reconstructions load (null), or on with them. */
export type SeaLevelView =
  { readonly on: false } | { readonly on: true; readonly index: SeaLevelIndex | null };

export interface SeaLevelChip {
  /** The chart, over the slider. */
  readonly chart: HTMLElement;
  /** The legend, among the bar's notes. */
  readonly legend: HTMLElement;
  /** The bar shows `oldest` to `youngest` Ma: today unless a part of its span (#1074). */
  render(view: SeaLevelView, ma: number, oldest: number, youngest?: number): void;
}

export function createSeaLevelChip(handlers: {
  /** A moment picked on the chart, thousands of years ago. */
  onKa(ka: number): void;
}): SeaLevelChip {
  const chart = createSeaLevelChart({
    onKa: (ka) => {
      handlers.onKa(ka);
    },
  });
  return {
    chart: chart.chart,
    legend: chart.legend,
    render(view, ma, oldest, youngest = 0) {
      chart.render(view.on ? view.index : null, ma * 1000, oldest * 1000, youngest * 1000);
    },
  };
}

export interface TemperatureChip {
  readonly legend: HTMLElement;
  render(view: TemperatureView): void;
}

export function createTemperatureChip(
  why: HTMLElement,
  /** The bar's own: a model, or what the colours show, picked. */
  handlers: {
    onTemperatureModel(model: TemperatureModel): void;
    onTemperatureShow(show: TemperatureShow): void;
  },
): TemperatureChip {
  const legend = createTemperatureLegend(why, {
    onModel: (model) => {
      handlers.onTemperatureModel(model);
    },
    onShow: (show) => {
      handlers.onTemperatureShow(show);
    },
  });
  return {
    legend: legend.root,
    render(view) {
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
  readonly note: HTMLElement;
  render(view: AirView, scale: DeepScale, oldest: number, ma: number, youngest?: number): void;
}

export function createAirChip(
  why: HTMLElement,
  handlers: { onCo2Archive(): void; redraw(): void },
): AirChip {
  const note = createDeepAirNote({
    why,
    onCo2Archive: () => {
      handlers.onCo2Archive();
    },
    redraw: () => {
      handlers.redraw();
    },
  });
  return {
    note: note.root,
    render(view, scale, oldest, ma, youngest = 0) {
      note.render(view, scale, oldest, ma, youngest);
    },
  };
}
