/**
 * Long animation frames sent to Honeycomb, and what was on screen during them (#636): why a
 * frame was slow, not only that it was. Bounded, as each span costs: only frames of at least
 * MIN_MS, the longest of each WINDOW_MS, at most MOST a page. The INP span gets the longest
 * frame of its interaction as `inp.loaf.*`, at no extra span.
 */

import { type ScreenNames, screenNames } from '../util/screenNames';
import type { Attributes } from './attributes';
import { frameAttributes, type LongFrame, namesAttributes } from './longFrames';

/** Frames shorter than this are not sent: Chrome reports from 50 ms, and those are common. */
export const MIN_MS = 100;
/** One frame, the longest, from each stretch this long that has any. */
export const WINDOW_MS = 5000;
/** At most this many frame spans a page load. */
export const MOST = 20;
/** Frames whose screen state is kept for the INP span to find: the last few seconds' worth. */
const NOTES = 64;

/** The slice of an OpenTelemetry tracer used here; the real one satisfies it. */
export interface SpanStarter {
  startSpan(
    name: string,
    options: { startTime: number; attributes: Attributes },
  ): { end(endTime: number): void };
}

export interface LongFramesOptions {
  readonly tracer: SpanStarter;
  /** The page's origin: only scripts from it are named by URL. */
  readonly origin: string;
  /** What is on screen now. */
  readonly names: () => ScreenNames;
  /** Run `run` in `ms`: `setTimeout`, in the page. */
  readonly later: (run: () => void, ms: number) => void;
}

function longest(frames: readonly LongFrame[]): LongFrame | undefined {
  return frames.reduce<LongFrame | undefined>(
    (worst, frame) => (worst === undefined || frame.duration > worst.duration ? frame : worst),
    undefined,
  );
}

function isLongFrame(entry: unknown): entry is LongFrame {
  return (
    typeof entry === 'object' && entry !== null && 'scripts' in entry && 'renderStart' in entry
  );
}

/** The long frames web-vitals found in an INP interaction; none from any other metric. */
export function inpFrames(vital: unknown): LongFrame[] {
  if (typeof vital !== 'object' || vital === null || !('attribution' in vital)) return [];
  const { attribution } = vital;
  if (typeof attribution !== 'object' || attribution === null) return [];
  if (!('longAnimationFrameEntries' in attribution)) return [];
  const entries = attribution.longAnimationFrameEntries;
  return Array.isArray(entries) ? entries.filter(isLongFrame) : [];
}

export class LongFrames {
  readonly #options: LongFramesOptions;
  /** What was on screen in each recent long frame, by its start time. */
  readonly #notes = new Map<number, ScreenNames>();
  #worst: { readonly frame: LongFrame; readonly names: ScreenNames } | null = null;
  #sent = 0;

  constructor(options: LongFramesOptions) {
    this.#options = options;
  }

  /** Frames the observer reports, soon after each ends: the screen is as it was then. */
  readonly observed = (frames: readonly LongFrame[]): void => {
    for (const frame of frames) {
      const names = this.#options.names();
      this.#notes.set(frame.startTime, names);
      if (this.#notes.size > NOTES) this.#notes.delete(this.#notes.keys().next().value ?? 0);
      if (frame.duration < MIN_MS || this.#sent >= MOST) continue;
      if (this.#worst === null) this.#options.later(this.#send, WINDOW_MS);
      if (this.#worst === null || frame.duration > this.#worst.frame.duration) {
        this.#worst = { frame, names };
      }
    }
  };

  /** For the INP span: its longest frame, and what was on screen then. */
  inpAttributes(frames: readonly LongFrame[]): Attributes {
    const worst = longest(frames);
    const noted = worst === undefined ? undefined : this.#notes.get(worst.startTime);
    return {
      'inp.loaf.count': frames.length,
      ...(worst === undefined ? {} : frameAttributes(worst, this.#options.origin, 'inp.loaf', 1)),
      ...namesAttributes(noted ?? this.#options.names()),
      // Web-vitals reports INP late, often as the page is hidden: say whether the names are
      // those of the interaction's frame or only those of the moment it was reported.
      'app.names.when': noted === undefined ? 'report' : 'frame',
    };
  }

  /** The SDK's INP hook: `webVitalsInstrumentationConfig.inp.applyCustomAttributes`. */
  readonly annotateInp = (
    vital: unknown,
    span: { setAttributes(a: Attributes): unknown },
  ): void => {
    span.setAttributes(this.inpAttributes(inpFrames(vital)));
  };

  readonly #send = (): void => {
    const worst = this.#worst;
    this.#worst = null;
    if (worst === null) return;
    this.#sent += 1;
    const { frame, names } = worst;
    const attributes = {
      ...frameAttributes(frame, this.#options.origin),
      ...namesAttributes(names),
      'app.names.when': 'frame',
      'loaf.sent': this.#sent,
    };
    this.#options.tracer
      .startSpan('long-animation-frame', { startTime: frame.startTime, attributes })
      .end(frame.startTime + frame.duration);
  };
}

/** The slice of `PerformanceObserver` used here. */
export interface ObserverClass {
  readonly supportedEntryTypes: readonly string[];
  new (callback: (list: { getEntries(): readonly unknown[] }) => void): {
    observe(options: { type: string }): void;
  };
}

/** Starts reporting long frames to `frames`, where the browser has them; says whether it does. */
export function watchLongFrames(frames: LongFrames, Observer: ObserverClass | undefined): boolean {
  if (Observer?.supportedEntryTypes.includes('long-animation-frame') !== true) return false;
  new Observer((list) => {
    frames.observed(list.getEntries().filter(isLongFrame));
  }).observe({ type: 'long-animation-frame' });
  return true;
}

/** The slice of `window` the frames are watched from; the real one satisfies it. */
export interface FramePage {
  readonly location: { readonly origin: string };
  readonly PerformanceObserver?: ObserverClass;
  setTimeout(run: () => void, ms: number): unknown;
}

/** Sends `page`'s long frames as spans from `tracer`, with the globe's names as last placed. */
export function startLongFrames(tracer: SpanStarter, page: FramePage): LongFrames {
  const frames = new LongFrames({
    tracer,
    origin: page.location.origin,
    names: screenNames,
    later: (run, ms) => {
      page.setTimeout(run, ms);
    },
  });
  watchLongFrames(frames, page.PerformanceObserver);
  return frames;
}
