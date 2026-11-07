/**
 * Time for an animation, read from the frames' own clock but never jumping far: a frame that
 * comes very late (the page busy loading a large map, say) moves it on by at most `maxStepMs`, so
 * a hitch pauses an animation rather than skipping it. The cap is a second, not less: on a device
 * that draws only a frame or two a second, a smaller one would drag the animation out for
 * minutes.
 */

export interface FrameClock {
  /** Milliseconds of animation so far, given this frame's time. */
  tick(now: number): number;
}

export function frameClock(maxStepMs = 1000): FrameClock {
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
