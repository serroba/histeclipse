/**
 * Playing eases near what can be read (#1077): as the playhead nears a milestone, or a find of a
 * layer that is on, it slows, so the moment can be read as it passes, and speeds up again
 * beyond it. How much it slows depends only on where the playhead is, not on the clock, so
 * play is the same at any frame rate and in tests.
 */

/** The slowest play gets at a mark: a fifth of its pace. */
export const EASE_FLOOR = 0.2;

/**
 * How far before and after a mark play slows: what the pace covers in this many seconds. Short,
 * as the 540 Myr span alone has 16 milestones: longer, and play would be slow all the way.
 */
const EASE_SECONDS = 0.6;

/**
 * The share of its pace play goes at `ma`, playing at `maPerSecond`, with `marks` (Ma) about:
 * 1 away from them, down to `EASE_FLOOR` on one, smoothly between.
 */
export function easeAt(ma: number, maPerSecond: number, marks: readonly number[]): number {
  const reach = maPerSecond * EASE_SECONDS;
  if (reach <= 0) return 1;
  let share = 1;
  for (const mark of marks) {
    const away = Math.abs(ma - mark);
    if (away >= reach) continue;
    const t = away / reach;
    share = Math.min(share, EASE_FLOOR + (1 - EASE_FLOOR) * t * t * (3 - 2 * t));
  }
  return share;
}
