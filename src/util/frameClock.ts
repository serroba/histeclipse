/**
 * Time for an animation, read from the frames' own clock but never jumping: a frame that comes
 * late (the page busy loading a large map, say) moves it on by at most `maxStepMs`, so a hitch
 * pauses an animation rather than skipping it.
 */

export interface FrameClock {
  /** Milliseconds of animation so far, given this frame's time. */
  tick(now: number): number;
}

export function frameClock(maxStepMs = 100): FrameClock {
  let last: number | null = null;
  let elapsed = 0;
  return {
    tick(now) {
      if (last !== null) elapsed += Math.min(Math.max(0, now - last), maxStepMs);
      last = now;
      return elapsed;
    },
  };
}
