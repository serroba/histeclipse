/**
 * What an impact looks like at a moment: how far the impactor has fallen, the flash, the blast
 * spreading, the crater, and over the whole globe the ejecta's front, the glowing sky and the
 * veil (`ShellMoment`). Two clocks give it: the short illustration's own (`illustratedLook`, in
 * milliseconds of play), and the strike clock's real time after the strike (`strikeLook`, in
 * seconds, #1173), each phase at the time it happened.
 *
 * Pure.
 */

import { APPROACH_SECONDS } from '../deepTime/strikeClock';
import { clamp01 } from '../util/timing';
import { shellAt, type ShellMoment } from './impactShell';
import { APPROACH, RING, type ImpactSizes } from './impactSizes';

export interface ImpactLook {
  /** How far the impactor has come, 0 (far out) to 1 (struck). */
  readonly falling: number;
  /** How far through the flash, 0 to 1; null when there is none. */
  readonly flashing: number | null;
  /** How far the blast has spread, 0 to 1; null when there is none. */
  readonly spreading: number | null;
  /** How plain the crater is, 0 to 1. */
  readonly crater: number;
  /** The worldwide shell: its front, its glow, its veil. */
  readonly shell: ShellMoment;
}

/** The pace of the illustration: a smaller impact plays the same story quicker. */
export function illustratedPace(sizes: ImpactSizes): number {
  return 0.5 + 0.5 * Math.min(sizes.strength, 1);
}

/** How long the illustration plays, in its own time (ms at Chicxulub's pace). */
export function illustratedEnd(sizes: ImpactSizes): number {
  return sizes.totalMs / illustratedPace(sizes);
}

/** The illustration `t` ms in, at Chicxulub's pace (#314, #1167). */
export function illustratedLook(t: number, sizes: ImpactSizes): ImpactLook {
  const end = illustratedEnd(sizes);
  const flashing = clamp01((t - APPROACH) / sizes.flashMs);
  const spreading = clamp01((t - APPROACH) / RING);
  const settled = clamp01((t - APPROACH - sizes.flashMs) / 600);
  const leaving = clamp01((t - (end - 800)) / 800);
  return {
    falling: clamp01(t / APPROACH),
    flashing: t >= APPROACH && flashing < 1 ? flashing : null,
    spreading: t >= APPROACH && spreading < 1 ? spreading : null,
    crater: settled * (1 - leaving),
    shell: shellAt(t - APPROACH, end - APPROACH, sizes.worldwide),
  };
}

const MINUTE = 60;
const HOUR = 3600;
const DAY = 86_400;
const YEAR = 365.25 * DAY;

/** How far through, 0 to 1, `t` is between `from` and `to` seconds, on a log scale. */
function logThrough(t: number, from: number, to: number): number {
  if (t <= from) return 0;
  return clamp01(Math.log(t / from) / Math.log(to / from));
}

/**
 * The strike `seconds` after it struck (negative: still coming in), for an impact reaching
 * `worldwide` (0 to 1) of the way round. The times are those of the studies the strike clock
 * cites for each phase.
 */
export function strikeLook(seconds: number, worldwide: number): ImpactLook {
  const t = seconds;
  // Most of the ejecta are back within eight hours (Kring & Durda 2002).
  const out = logThrough(t, 15 * MINUTE, 8 * HOUR);
  const struck = t > 0;
  return {
    falling: clamp01(1 + t / APPROACH_SECONDS),
    // The fireball, over the first minute.
    flashing: struck && t < MINUTE ? logThrough(t, 0.1, MINUTE) : null,
    // The blast and the ejecta curtain round the crater, over the first ten minutes.
    spreading: struck && t < 10 * MINUTE ? logThrough(t, 1, 10 * MINUTE) : null,
    // The crater settles into its final shape within minutes, and stays.
    crater: logThrough(t, MINUTE, 10 * MINUTE),
    shell: {
      visible: struck && worldwide > 0,
      // The ejecta fall back in round the whole globe within the first hours.
      front: Math.PI * worldwide * out,
      // Bright only while it travels: not before it leaves the crater, nor once round.
      frontGlow: out > 0 && out < 1 ? worldwide * (1 - 0.5 * out) * Math.min(1, out * 10) : 0,
      // The sky glows as they come in, most within three days.
      ember: logThrough(t, 5 * MINUTE, 30 * MINUTE) * (1 - logThrough(t, 8 * HOUR, 3 * DAY)),
      // Then soot, dust and sulfate darken it within two weeks: little or no sunlight for over a
      // year, photosynthesis stopped for one to two, the soot gone after about five (Bardeen et
      // al. 2017). The colder climate lasts decades, but the dark does not (#1187).
      veil:
        0.8 *
        worldwide *
        logThrough(t, DAY, 2 * 7 * DAY) *
        (1 - logThrough(t, 1.5 * YEAR, 6 * YEAR)),
    },
  };
}
