/**
 * Playing days by (#702): the moment moves on with the time that passed, not the frames drawn,
 * at the pace asked for at each moment, and stops at the end. Every frame moves it on, to the
 * minute, the finest time kept, so the planets and the craft glide at any pace (#770). Earth's
 * face alone keeps to whole days from where play started while it plays a day or more a second,
 * so the globe holds still as the years go by instead of spinning a blur. A frame after a stall
 * (a hidden tab) counts as a quarter of a second at most. Starting and stopping are signalled
 * (#764), with the pace and how often it slowed, for the telemetry to time the frames between.
 */

import { signalPlayback } from '../../util/playbackSignal';

const LONGEST_FRAME = 0.25;
/** Seconds of play worked out at one pace, at most. */
const SUBSTEP = 1 / 120;
const MINUTE = 1 / 1440;
/** At this many days a second or more, Earth's face keeps to whole days. */
const STILL_FACE = 1;

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
  /** The moment Earth's face is shown turned to at `jd`: while playing a day or more a second,
   * the whole day nearest from where play started; else `jd`. */
  face(jd: number): number;
}

/**
 * For the telemetry (#764): the pace play started at, its fastest and slowest, and how often it
 * fell below half the fastest yet: the slowdowns at departures.
 */
function paceTally() {
  let startPace = 0;
  let fastest = 0;
  let slowest = 0;
  let slowdowns = 0;
  let slow = false;
  return {
    reset(pace: number): void {
      startPace = pace;
      fastest = pace;
      slowest = pace;
      slowdowns = 0;
      slow = false;
    },
    /** A pace played at: kept, and given back. */
    paced(pace: number): number {
      slowest = Math.min(slowest, pace);
      fastest = Math.max(fastest, pace);
      const below = pace < fastest / 2;
      if (below && !slow) slowdowns += 1;
      slow = below;
      return pace;
    },
    said: () => ({ startPace, fastestPace: fastest, slowestPace: slowest, slowdowns }),
  };
}

export function dayPlay(hooks: DayPlayHooks): DayPlay {
  let playing = false;
  let frame = 0;
  let tick = 0;
  // Where play has got to, unrounded: shown a minute at a time; where it started; how fast.
  let head = 0;
  let from = 0;
  let pace = 0;
  const tally = paceTally();

  function stopped(reason: 'stopped' | 'ended'): void {
    signalPlayback({
      phase: 'stop',
      kind: 'launches',
      detail: { reason, ...tally.said(), fromJd: from, toJd: head },
    });
  }

  function step(now: number): void {
    if (!playing) return;
    const seconds = Math.min(Math.max(now - tick, 0) / 1000, LONGEST_FRAME);
    tick = now;
    const end = hooks.end();
    const at = hooks.at();
    // In short steps, each at its own pace, so a long frame cannot pass a slow stretch by.
    for (let left = seconds; left > 0 && head < end; left -= SUBSTEP) {
      pace = tally.paced(hooks.pace(head));
      head = Math.min(head + pace * Math.min(left, SUBSTEP), end);
    }
    // A hair either way: sums of many short steps fall a little short.
    const minutes = Math.floor((head - at) / MINUTE + 1e-3);
    if (minutes >= 1) hooks.go(at + minutes * MINUTE);
    if (head >= end) {
      playing = false;
      stopped('ended');
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
      from = head;
      pace = hooks.pace(head);
      tally.reset(pace);
      signalPlayback({
        phase: 'start',
        kind: 'launches',
        detail: { startPace: pace, fromJd: from },
      });
      tick = performance.now();
      frame = requestAnimationFrame(step);
    },
    stop() {
      if (!playing) return false;
      playing = false;
      cancelAnimationFrame(frame);
      stopped('stopped');
      return true;
    },
    face(jd) {
      return playing && pace >= STILL_FACE ? from + Math.round(jd - from) : jd;
    },
  };
}
