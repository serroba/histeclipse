/**
 * How smooth play was (#764): from play's start to its stop, the gap between each frame drawn,
 * sent as one `playback` span with what the player said of itself (its pace, how often it
 * slowed). Long-frame spans (`frameWatch.ts`) name only frames of 100 ms or more; this counts
 * every frame, so stutter below that shows. Bounded: one span a play, at most MOST a page.
 */

import { PLAYBACK_EVENT, type PlaybackSignal, type PlaybackValue } from '../util/playbackSignal';
import type { Attributes } from './attributes';
import type { SpanStarter } from './frameWatch';

/** At most this many playback spans a page load. */
export const MOST = 20;

/** The slice of the page the frames are timed with; `window` satisfies it. */
export interface FrameClock {
  requestAnimationFrame(run: (now: number) => void): number;
  cancelAnimationFrame(handle: number): void;
}

/** The gaps between frames, summarised: how many, typical, tail, worst, and how many were slow. */
export function frameStats(gaps: readonly number[]): Attributes {
  if (gaps.length === 0) return { 'playback.frames': 0 };
  const sorted = [...gaps].sort((a, b) => a - b);
  const at = (share: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0;
  const over = (ms: number): number => gaps.filter((gap) => gap > ms).length;
  const total = gaps.reduce((sum, gap) => sum + gap, 0);
  const round = (ms: number): number => Math.round(ms * 10) / 10;
  return {
    'playback.frames': gaps.length,
    'playback.fps': round((gaps.length * 1000) / total),
    'playback.gap_p50_ms': round(at(0.5)),
    'playback.gap_p95_ms': round(at(0.95)),
    'playback.gap_p99_ms': round(at(0.99)),
    'playback.gap_max_ms': round(sorted.at(-1) ?? 0),
    // A gap over 34 ms missed a 60 Hz frame; over 50, two; over 100, a visible stall.
    'playback.gaps_over_34ms': over(34),
    'playback.gaps_over_50ms': over(50),
    'playback.gaps_over_100ms': over(100),
  };
}

const said = (detail: Readonly<Record<string, PlaybackValue>>): Attributes =>
  Object.fromEntries(Object.entries(detail).map(([key, value]) => [`playback.${key}`, value]));

export class PlaybackFrames {
  readonly #tracer: SpanStarter;
  readonly #clock: FrameClock;
  #play: {
    readonly kind: string;
    readonly start: Attributes;
    readonly gaps: number[];
    began: number;
    last: number;
    handle: number;
  } | null = null;
  #sent = 0;

  constructor(tracer: SpanStarter, clock: FrameClock) {
    this.#tracer = tracer;
    this.#clock = clock;
  }

  /** Play started or stopped, as the player signals. */
  readonly signalled = (signal: PlaybackSignal): void => {
    if (signal.phase === 'start') this.#begin(signal);
    else this.#end(said(signal.detail));
  };

  /** The page was hidden: frames stop, so the play is sent as it stands. */
  readonly hidden = (): void => {
    this.#end({ 'playback.reason': 'hidden' });
  };

  #begin(signal: PlaybackSignal): void {
    this.#end({ 'playback.reason': 'restarted' });
    const play = {
      kind: signal.kind,
      start: said(signal.detail),
      gaps: [] as number[],
      began: Number.NaN,
      last: Number.NaN,
      handle: 0,
    };
    const frame = (now: number): void => {
      if (Number.isNaN(play.began)) play.began = now;
      else play.gaps.push(now - play.last);
      play.last = now;
      play.handle = this.#clock.requestAnimationFrame(frame);
    };
    play.handle = this.#clock.requestAnimationFrame(frame);
    this.#play = play;
  }

  #end(detail: Attributes): void {
    const play = this.#play;
    if (play === null) return;
    this.#play = null;
    this.#clock.cancelAnimationFrame(play.handle);
    if (play.gaps.length === 0 || this.#sent >= MOST) return;
    this.#sent += 1;
    this.#tracer
      .startSpan('playback', {
        startTime: performance.timeOrigin + play.began,
        attributes: {
          'playback.kind': play.kind,
          ...play.start,
          ...detail,
          'playback.seconds': Math.round(play.last - play.began) / 1000,
          ...frameStats(play.gaps),
          'playback.sent': this.#sent,
        },
      })
      .end(performance.timeOrigin + play.last);
  }
}

/** The slice of `window` play is watched from. */
export interface PlaybackPage extends FrameClock, EventTarget {
  readonly document: EventTarget & { readonly visibilityState: string };
}

/** Sends each play on `page` as a `playback` span from `tracer`. */
export function startPlaybackWatch(tracer: SpanStarter, page: PlaybackPage): PlaybackFrames {
  const frames = new PlaybackFrames(tracer, page);
  page.addEventListener(PLAYBACK_EVENT, (event) => {
    if (event instanceof CustomEvent) frames.signalled(event.detail as PlaybackSignal);
  });
  page.document.addEventListener('visibilitychange', () => {
    if (page.document.visibilityState === 'hidden') frames.hidden();
  });
  return frames;
}
