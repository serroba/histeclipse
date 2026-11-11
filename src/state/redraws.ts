/**
 * What each part of the page redraws on (#381): the view state's fields it reads, as a list a
 * subscriber compares with `changed`. Kept here, with tests, rather than as hand-written
 * comparisons in `app.ts`'s render, where a field left out is a part that goes stale.
 */

import { changed } from './store';
import type { ViewState } from './viewState';

export type Watch = (state: ViewState) => readonly unknown[];

/** Deep time's globe and bar: the moment, its span, and every choice of how it is drawn. */
export const DEEP_TIME: Watch = (s) => [
  s.ma,
  s.time,
  s.years,
  s.layers,
  s.deepScale,
  s.coast,
  s.seaIce,
  s.temperatureModel,
  s.dispersal,
  s.impact,
  s.land,
  s.snowball,
];

/** The sky view: where and when it is seen from, and what is drawn on it. */
export const SKY: Watch = (s) => [
  s.mode,
  s.time,
  s.location,
  s.look,
  s.figures,
  s.culture,
  s.focus,
  s.camera,
];

/** The orbits drawn: they come and go as the view moves out and in, or turns elsewhere. */
export const ORBITS: Watch = (s) => [s.layers, s.camera, s.focus, s.mode, s.ma];

/** The Sun's look: which body is in view, and which of the Sun's channels. */
export const SUN: Watch = (s) => [s.focus, s.mode, s.sunLayer];

/** The layers on Earth: dates, ways, rocks, periods, impacts, carbon-14 and states. */
export const EARTH_LAYERS: Watch = (s) => [
  s.layers,
  s.mode,
  s.borders,
  s.ma,
  s.deepScale,
  s.time.date.year,
  s.location,
];

/** The history track: its year, the layers on it, and (for radiocarbon) the hemisphere. */
export const HISTORY: Watch = (s) => [s.time.date.year, s.layers, s.location];

/** The eclipse picked, drawn in full. */
export const SELECTION: Watch = (s) => [s.selection, s.layers, s.location, s.seenIn];

/** Whether what `watch` reads differs between the two states; always, with none before. */
export function redraws(watch: Watch, state: ViewState, previous: ViewState | null): boolean {
  return previous === null || changed(watch(previous), watch(state));
}
