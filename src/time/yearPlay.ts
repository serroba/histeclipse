/**
 * Playing the Holocene's years by. The years advance with the time that passed, not the frames
 * drawn, so a 120 Hz display goes no faster than a 60 Hz one; and they are kept unrounded, so a
 * fraction of a year a frame still adds up.
 */

/** Years a second the track can play at. */
export const YEAR_SPEEDS = [10, 50, 200, 1000] as const;
export type YearSpeed = (typeof YEAR_SPEEDS)[number];

/** A frame after a stall (a hidden tab, a busy machine) counts as this long at most, seconds. */
const LONGEST_FRAME = 0.25;

export interface YearPlayhead {
  /**
   * The whole year to show after `seconds` more at `speed` years a second, from the year
   * `shown`, stopping at `last`. A year changed elsewhere (the slider, the year typed) is
   * carried on from.
   */
  step(shown: number, speed: number, seconds: number, last: number): number;
}

/** The whole year of a position, forgiving sums of frames that fall a hair short. */
function wholeYear(position: number): number {
  return Math.floor(position + 1e-9);
}

export function yearPlayhead(): YearPlayhead {
  let position: number | null = null;
  return {
    step(shown, speed, seconds, last) {
      if (position === null || wholeYear(position) !== shown) position = shown;
      position = Math.min(last, position + speed * Math.min(Math.max(seconds, 0), LONGEST_FRAME));
      return wholeYear(position);
    },
  };
}
