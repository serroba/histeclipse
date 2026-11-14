/**
 * The sky's moment (#666): where the Sun, the Moon and the observer stand, the horizon there and
 * what an eclipse under way looks like, worked out once for each time and place. Turning the
 * view, zooming or gliding changes neither, so a drag or a glide does not work it out again.
 * Pure.
 */

import type { BodiesSeen } from '../../sky/aim';
import { moonSunlight, sunVisible, topocentric } from '../../sky/bodies';
import { horizonMatrix, horizontalOf } from '../../sky/horizon';
import type { ViewState } from '../../state/viewState';
import { eclipseNote } from './caption';

/** The inputs of a moment, compared by identity: a new object always counts as a change. */
export type MomentKey = readonly unknown[];

/**
 * The moment's inputs in `state`: the time, and where the observer stands (the place picked, or
 * else the middle of the globe in view while on Earth); `moonReady`, whether the Moon can be had.
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

/** A moment of the sky, worked out. */
export interface SkyMoment {
  readonly seen: BodiesSeen;
  readonly horizon: ReturnType<typeof horizonMatrix>;
  /** What an eclipse under way looks like from here; empty when none is. */
  readonly eclipseText: string;
}

/** The horizon and the eclipse note for the bodies as seen. */
export function skyMoment(seen: BodiesSeen): SkyMoment {
  const horizon = horizonMatrix(seen.place, seen.jdUT, seen.jdTT);
  const sunHere = topocentric(seen.sun, seen.observer);
  const moonHere = seen.moon === null ? null : topocentric(seen.moon, seen.observer);
  const eclipseText =
    seen.moon === null || moonHere === null
      ? ''
      : eclipseNote({
          sunVisible: sunVisible(sunHere, moonHere),
          sunAltitude: horizontalOf(horizon, sunHere).altitude,
          moonSunlight: moonSunlight(seen.moon, seen.sun),
          moonAltitude: horizontalOf(horizon, moonHere).altitude,
        });
  return { seen, horizon, eclipseText };
}

/**
 * The moment for a state, kept until its key changes. `bodiesSeen` says where the bodies stand;
 * a moment beyond its reach (null, beyond ΔT's) is asked for again next time.
 */
export function momentCache(
  bodiesSeen: (state: ViewState) => BodiesSeen | null,
  moonReady: () => boolean,
): (state: ViewState) => SkyMoment | null {
  let kept: { key: MomentKey; moment: SkyMoment } | null = null;
  return (state) => {
    const key = momentKey(state, moonReady());
    if (kept !== null && sameMoment(kept.key, key)) return kept.moment;
    const seen = bodiesSeen(state);
    kept = seen === null ? null : { key, moment: skyMoment(seen) };
    return kept?.moment ?? null;
  };
}
