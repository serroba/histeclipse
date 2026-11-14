/**
 * Playing days by (#702): the moment moves on with the time that passed, not the frames drawn,
 * at the pace asked for at each moment, and stops at the end. A day or more a second steps
 * whole days, so Earth's turning holds still as the years go by; slower steps whole minutes, the
 * finest time kept, so a craft leaving glides. A frame after a stall (a hidden tab) counts as a
 * quarter of a second at most.
 */

const LONGEST_FRAME = 0.25;
/** Seconds of play worked out at one pace, at most. */
const SUBSTEP = 1 / 120;
/** At this many days a second or more, whole days a step. */
const WHOLE_DAYS = 20;

export interface DayPlayHooks {
  /** Days a second at a moment (UT Julian Day). */
  pace(jd: number): number;
  /** The moment shown, UT Julian Day. */
  at(): number;
  /** Show this moment. */
  go(jd: number): void;
  /** The last day it plays to. */
  end(): number;
  /** It stopped by itself, at the end. */
  ended(): void;
}

export interface DayPlay {
  readonly playing: boolean;
  start(): void;
  /** Stop; false if it was not playing. */
  stop(): boolean;
}

export function dayPlay(hooks: DayPlayHooks): DayPlay {
  let playing = false;
  let frame = 0;
  let tick = 0;
  // Where play has got to, unrounded: shown a whole step at a time.
  let head = 0;

  function step(now: number): void {
    if (!playing) return;
    const seconds = Math.min(Math.max(now - tick, 0) / 1000, LONGEST_FRAME);
    tick = now;
    const end = hooks.end();
    const at = hooks.at();
    // In short steps, each at its own pace, so a long frame cannot pass a slow stretch by.
    let pace = hooks.pace(head);
    for (let left = seconds; left > 0 && head < end; left -= SUBSTEP) {
      pace = hooks.pace(head);
      head = Math.min(head + pace * Math.min(left, SUBSTEP), end);
    }
    const size = pace >= WHOLE_DAYS ? 1 : 1 / 1440;
    // A hair either way: sums of many short steps fall a little short.
    const steps = Math.floor((head - at) / size + 1e-6);
    if (steps >= 1) hooks.go(at + steps * size);
    if (head >= end - 1) {
      playing = false;
      hooks.ended();
      return;
    }
    frame = requestAnimationFrame(step);
  }

  return {
    get playing() {
      return playing;
    },
    start() {
      playing = true;
      head = hooks.at();
      tick = performance.now();
      frame = requestAnimationFrame(step);
    },
    stop() {
      if (!playing) return false;
      playing = false;
      cancelAnimationFrame(frame);
      return true;
    },
  };
}
