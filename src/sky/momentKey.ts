/**
 * What the sky's moment depends on (#666): the time, where the observer stands, and whether the
 * Moon's ephemeris has arrived. Turning the view, zooming or gliding changes none of them, so the
 * Sun, the Moon, the planets and every star stay where they were computed. Pure.
 */

import type { ViewState } from '../state/viewState';

/** The inputs of a moment, compared by identity: a new object always counts as a change. */
export type MomentKey = readonly unknown[];

/**
 * The moment's inputs in `state`. The observer is the place picked, or else the middle of the
 * globe in view (its camera target, while on Earth); `moonReady` says whether the Moon can be had.
 */
export function momentKey(state: ViewState, moonReady: boolean): MomentKey {
  const located = state.location !== null;
  return [
    state.time,
    state.location,
    located ? null : state.focus,
    located || state.focus !== 'earth' ? null : state.camera.target,
    moonReady,
  ];
}

/** Whether two keys name the same moment. */
export function sameMoment(a: MomentKey | null, b: MomentKey): boolean {
  return a !== null && a.length === b.length && a.every((value, index) => value === b[index]);
}
