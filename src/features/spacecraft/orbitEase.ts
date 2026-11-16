/**
 * A craft that goes round Earth in an hour and a half (#795), played at days a second, is many
 * laps between two frames: wherever each frame lands it on its circle, the dot strobes. So the
 * dot goes round no faster than a calm pace (`MOST_LAP_A_FRAME`) however fast time plays, its
 * circle and the swing of its plane still following time exactly; at a pace slow enough to see
 * it is where it truly is. Its place along the circle is approximate in any case (#795).
 */

import { lapDays } from './earthOrbit';
import type { Craft } from '../../data/spacecraft';

/** The most of a lap a dot goes round in a frame: about a lap in a few seconds at 60 frames. */
export const MOST_LAP_A_FRAME = 0.006;

/** The moment a craft's dot is drawn at, for a frame at `jdTT`. */
export type Eased = (craft: Craft, jdTT: number) => number;

/**
 * Easing kept from frame to frame. For a craft in orbit about Earth: the moment itself while
 * time moves slowly; once it moves more than `mostLap` of a lap a frame, a moment that goes on
 * that much each frame in the same direction, brought back to within half a lap of the true one
 * so its plane is where time puts it. Asked again at the same moment (a redraw), it answers as
 * before.
 */
export function easedOrbits(mostLap = MOST_LAP_A_FRAME): Eased {
  const last = new Map<string, Frame>();
  return ({ id, orbit }, jdTT) => {
    if (orbit === undefined) return jdTT;
    const before = last.get(id);
    if (before?.jd === jdTT) return before.shown;
    const lap = lapDays(orbit);
    const step = before === undefined ? 0 : jdTT - before.jd;
    const most = mostLap * lap;
    const gone =
      before !== undefined && Math.abs(step) > most ? before.gone + Math.sign(step) * most : jdTT;
    // Only where it is along the circle is eased: kept within half a lap of the true moment, so
    // the plane it goes round in is where time puts it.
    const late = gone - jdTT;
    const shown = jdTT + late - lap * Math.round(late / lap);
    last.set(id, { jd: jdTT, gone, shown });
    return shown;
  };
}

/** What was last drawn for a craft: its moment, the eased moment unwrapped, and as answered. */
interface Frame {
  readonly jd: number;
  readonly gone: number;
  readonly shown: number;
}
