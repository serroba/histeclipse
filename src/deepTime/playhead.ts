/**
 * Where play has reached in deep time, kept unrounded between frames. The date in the view is
 * rounded to the nearest thousand years; stepping from that rounded value would lose every
 * frame's step smaller than half of it, so at 120 frames a second the ice ages never moved.
 */

import { roundMa } from './scale';

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

/** A playhead along a part's own timeline (#1276): play's position on it, kept unrounded. */
export interface AxisPlayhead {
  /**
   * Advance by `seconds` at `share` of the Normal pace from `shown`, along `axis`; return where
   * play has reached, unrounded (the view keeps it rounded to a thousand years).
   */
  step(
    axis: { at(ma: number): number; ma(seconds: number): number },
    shown: number,
    share: number,
    seconds: number,
  ): number;
}

export function axisPlayhead(): AxisPlayhead {
  let along: number | null = null;
  let reached: number | null = null;
  return {
    step(axis, shown, share, seconds) {
      // The reader moved the slider (or play just began): carry on from what is shown.
      if (along === null || reached === null || roundMa(reached) !== shown) along = axis.at(shown);
      along += share * Math.min(Math.max(seconds, 0), LONGEST_FRAME);
      reached = Math.max(0, axis.ma(along));
      return reached;
    },
  };
}
