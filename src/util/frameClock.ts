/**
 * Time for an animation, read from the frames' own clock but never jumping far: a frame that
 * comes very late (the page busy loading a large map, say) moves it on by at most `maxStepMs`, so
 * a hitch pauses an animation rather than skipping it. The cap is a second, not less: on a device
 * that draws only a frame or two a second, a smaller one would drag the animation out for
 * minutes. It can be held still, as when what plays it pauses, and nudged a step (#807).
 */

export interface FrameClock {
  /** Milliseconds of animation so far, given this frame's time. */
  tick(now: number): number;
  /** Held, frames pass and its time does not. */
  readonly held: () => boolean;
  readonly hold: (held: boolean) => void;
  /** Move its time by `ms` (back, if negative), never to before it began. */
  nudge(ms: number): void;
}

export function frameClock(maxStepMs = 1000): FrameClock {
  let last: number | null = null;
  let elapsed = 0;
  let held = false;
  return {
    tick(now) {
      if (last !== null && !held) elapsed += Math.min(Math.max(0, now - last), maxStepMs);
      last = now;
      return elapsed;
    },
    held: () => held,
    hold: (next) => {
      held = next;
    },
    nudge(ms) {
      elapsed = Math.max(0, elapsed + ms);
    },
  };
}
