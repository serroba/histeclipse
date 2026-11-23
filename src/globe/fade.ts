/**
 * A value eased to its target over a moment of real time (#1140), so a change the globe draws
 * reads as a cross-fade and not a cut: the Hadean's molten surface giving way to its first
 * ocean happens within a frame of play, a million years in a few milliseconds. Only the drawing
 * is smoothed; the moment it changes stays where the sources put it. With less motion asked for,
 * or the first time it is set, it goes at once.
 */

export interface FadeClock {
  readonly now: () => number;
  readonly frame: (step: () => void) => void;
  readonly reduced: () => boolean;
}

const browserClock: FadeClock = {
  now: () => performance.now(),
  frame: (step) => {
    requestAnimationFrame(step);
  },
  reduced: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

export interface Fade {
  /** Head for `target`: eased, or at once when `now` (or less motion is asked for). */
  set(target: number, now?: boolean): void;
}

/** A fade over `ms`, calling `draw` with each value on the way. */
export function createFade(
  draw: (value: number) => void,
  ms = 700,
  clock: FadeClock = browserClock,
): Fade {
  let value: number | null = null;
  let target = 0;
  let from = 0;
  let start = 0;
  // Which run of frames is current: a new one, or a jump, ends the one before.
  let run = 0;
  function step(mine: number): void {
    if (mine !== run || value === null) return;
    const t = Math.min(1, (clock.now() - start) / ms);
    value = from + (target - from) * t * t * (3 - 2 * t);
    draw(value);
    if (t < 1) {
      clock.frame(() => {
        step(mine);
      });
    }
  }
  return {
    set(next, now = false) {
      if (value !== null && next === target) return;
      target = next;
      run += 1;
      if (value === null || now || clock.reduced()) {
        value = next;
        draw(value);
        return;
      }
      from = value;
      start = clock.now();
      const mine = run;
      clock.frame(() => {
        step(mine);
      });
    },
  };
}
