/**
 * A clock's frames on a struggling device (#1267's CI, a phone, software graphics): after a slow
 * frame, the next waits as long as it took, so playing leaves the page time to keep up.
 */

/**
 * A frame slower than this, ms (under 20 a second), means the device is struggling (a phone, or
 * software graphics, where each frame of the globe takes long to draw): the next waits as long
 * as this one took, so playing takes at most half of the page's time and it stays responsive.
 */
const SLOW_FRAME = 50;
/** The longest such wait, ms. */
const LONGEST_WAIT = 500;

export interface FramePacer {
  /** A frame came at `now` ms: how long since the last, ms (0 for the first since `reset`). */
  gap(now: number): number;
  /**
   * Ask for `tick`: at once, or after a slow frame, as long as it took (as the currents' streaks
   * do, #927). Returns how to cancel it.
   */
  ask(tick: FrameRequestCallback): () => void;
  /** Play starts again: no frame before it. */
  reset(): void;
}

/**
 * How a clock asks for its frames. A frame's own time is its gap less the wait asked before it:
 * with the wait counted in, one hitch made every frame after it look slow, and play stayed at two
 * frames a second for good (#1309). Each frame moves the clock on by at most a fifth of a second
 * of play, so a struggling device plays it slower, never skipping.
 */
export function framePacer(): FramePacer {
  let last: number | null = null;
  let gap = 0;
  let waited = 0;
  return {
    gap(now) {
      gap = last === null ? 0 : now - last;
      last = now;
      return gap;
    },
    ask(tick) {
      const cost = gap - waited;
      waited = cost > SLOW_FRAME ? Math.min(LONGEST_WAIT, cost) : 0;
      let id: number | null = null;
      const ask = (): void => {
        id = requestAnimationFrame(tick);
      };
      if (waited === 0) ask();
      const timer = waited > 0 ? setTimeout(ask, waited) : null;
      return () => {
        if (timer !== null) clearTimeout(timer);
        if (id !== null) cancelAnimationFrame(id);
      };
    },
    reset() {
      last = null;
      gap = 0;
      waited = 0;
    },
  };
}
