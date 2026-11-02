/**
 * Where play has reached in deep time, kept unrounded between frames. The date in the view is
 * rounded to the nearest thousand years; stepping from that rounded value would lose every
 * frame's step smaller than half of it, so at 120 frames a second the ice ages never moved.
 */

import { roundMa } from '../state/viewState';

/** Longest step one frame may take, seconds: a frame after a stall does not leap. */
const LONGEST_FRAME = 0.25;

export interface Playhead {
  /** Advance by `seconds` at `speed` (Ma a second) from `shown`; return the date to show. */
  step(shown: number, speed: number, seconds: number): number;
}

export function playhead(): Playhead {
  let position: number | null = null;
  return {
    step(shown, speed, seconds) {
      // The reader moved the slider (or play just began): carry on from what is shown.
      if (position === null || roundMa(position) !== shown) position = shown;
      position = Math.max(0, position - speed * Math.min(Math.max(seconds, 0), LONGEST_FRAME));
      return roundMa(position);
    },
  };
}
