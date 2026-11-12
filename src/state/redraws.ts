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
  s.temperatureShow,
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

/** The sky as shown: what `SKY` reads while in it, and nothing while away from it. */
export const SKY_SHOWN: Watch = (s) => (s.mode === 'sky' ? SKY(s) : [s.mode]);

/** The body in focus, its view from where, and the place picked: the globe's own fields. */
export const FOCUS: Watch = (s) => [s.focus];
export const VIEWPOINT: Watch = (s) => [s.view];
export const LOCATION: Watch = (s) => [s.location];

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

/** The Layers panel and the borders: Earth's layers, and it shuts on going to another body. */
export const LAYERS_PANEL: Watch = (s) => [...EARTH_LAYERS(s), s.focus];

/** The history track: its year, the layers on it, and (for radiocarbon) the hemisphere. */
export const HISTORY: Watch = (s) => [s.time.date.year, s.layers, s.location];

/** The eclipse picked, drawn in full. */
export const SELECTION: Watch = (s) => [s.selection, s.layers, s.location, s.seenIn];

/** The view switch: which views it offers depends on the mode and the body in view. */
export const VIEW_SWITCH: Watch = (s) => [s.view, s.mode, s.focus];

/** Once the visitor picks an eclipse, a place, a view or deep time, they have found the way in. */
export const FOUND_THE_WAY_IN: Watch = (s) => [s.selection, s.location, s.mode, s.view, s.ma];

/** Whether what `watch` reads differs between the two states; always, with none before. */
export function redraws(watch: Watch, state: ViewState, previous: ViewState | null): boolean {
  return previous === null || changed(watch(previous), watch(state));
}

/**
 * Whether the moment shown must be worked out again: its time or calendar changed, or deep time
 * was left for the years. Otherwise only the layers that watch what changed are shown again.
 */
export function momentChanged(state: ViewState, previous: ViewState | null): boolean {
  if (previous === null) return true;
  const leftDeepTime = previous.ma !== null && state.ma === null;
  return state.time !== previous.time || state.years !== previous.years || leftDeepTime;
}

/** The moment kept from the view before. */
export function momentKept(state: ViewState, previous: ViewState | null): previous is ViewState {
  return previous !== null && !momentChanged(state, previous);
}

/** When something on the page is drawn again, given the view now and before. */
export type When = (state: ViewState, previous: ViewState | null) => boolean;

/** Drawn first, and again whenever what `watch` reads changes. */
export function on(watch: Watch): When {
  return (state, previous) => redraws(watch, state, previous);
}

/** Drawn only when what `watch` reads changes: not first, as the page opens. */
export function onChange(watch: Watch): When {
  return (state, previous) => previous !== null && changed(watch(previous), watch(state));
}

/** Something on the page, drawn in its turn (#474). */
export interface Drawn {
  /** When it is drawn again; every time, if left out. */
  readonly when?: When;
  draw(state: ViewState, previous: ViewState | null): void;
}

/** Draw each in order, those whose `when` says so. */
export function drawAll(
  drawn: readonly Drawn[],
  state: ViewState,
  previous: ViewState | null,
): void {
  for (const each of drawn) {
    if (each.when?.(state, previous) ?? true) each.draw(state, previous);
  }
}
