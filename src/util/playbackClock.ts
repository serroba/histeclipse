/**
 * Time for an animation the reader can pause, step through and replay: it follows the frames'
 * own clock while playing, never jumping more than `maxStepMs` in one frame (as `frameClock`),
 * and holds at its end rather than running on.
 */

export interface PlaybackClock {
  /** Milliseconds into the animation, given this frame's time. */
  tick(now: number): number;
  readonly playing: boolean;
  /** Milliseconds into the animation now, seeks included, without waiting for a frame. */
  readonly position: number;
  /** Whether it has reached its end, at least once. */
  readonly ended: boolean;
  play(): void;
  pause(): void;
  /** Go to `ms` into the animation, within its length. */
  seek(ms: number): void;
}

export function playbackClock(durationMs: number, maxStepMs = 1000): PlaybackClock {
  let last: number | null = null;
  let elapsed = 0;
  let playing = true;
  let ended = false;
  return {
    tick(now) {
      if (playing && last !== null) {
        elapsed += Math.min(Math.max(0, now - last), maxStepMs);
        if (elapsed >= durationMs) {
          elapsed = durationMs;
          playing = false;
          ended = true;
        }
      }
      last = now;
      return elapsed;
    },
    get playing() {
      return playing;
    },
    get position() {
      return elapsed;
    },
    get ended() {
      return ended;
    },
    play() {
      // From the end, playing starts again from the beginning.
      if (elapsed >= durationMs) elapsed = 0;
      playing = true;
    },
    pause() {
      playing = false;
    },
    seek(ms) {
      elapsed = Math.min(durationMs, Math.max(0, ms));
    },
  };
}
