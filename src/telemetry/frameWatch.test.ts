import { describe, expect, it, vi } from 'vitest';

import { noteScreenNames, type ScreenNames } from '../util/screenNames';
import type { Attributes } from './attributes';
import {
  inpFrames,
  LongFrames,
  MIN_MS,
  MOST,
  type ObserverClass,
  startLongFrames,
  watchLongFrames,
  WINDOW_MS,
} from './frameWatch';
import type { LongFrame } from './longFrames';

const ORIGIN = 'https://histeclipse.example';

function frame(startTime: number, duration: number): LongFrame {
  return {
    startTime,
    duration,
    blockingDuration: duration - 50,
    renderStart: startTime + duration / 2,
    styleAndLayoutStart: startTime + duration / 2,
    firstUIEventTimestamp: 0,
    scripts: [],
  };
}

interface Sent {
  readonly name: string;
  readonly startTime: number;
  readonly attributes: Attributes;
  endTime?: number;
}

/** A LongFrames whose spans are kept, whose timers run when told, and whose screen is set. */
function harness() {
  const sent: Sent[] = [];
  const timers: (() => void)[] = [];
  let names: ScreenNames = { shown: 300, total: 400, turning: false };
  const frames = new LongFrames({
    tracer: {
      startSpan(name, { startTime, attributes }) {
        const span: Sent = { name, startTime, attributes };
        sent.push(span);
        return {
          end(endTime) {
            span.endTime = endTime;
          },
        };
      },
    },
    origin: ORIGIN,
    names: () => names,
    later: (run, ms) => {
      expect(ms).toBe(WINDOW_MS);
      timers.push(run);
    },
  });
  return {
    frames,
    sent,
    setNames: (next: ScreenNames) => {
      names = next;
    },
    /** Runs the timers due: the end of each window. */
    tick: () => {
      for (const run of timers.splice(0)) run();
    },
  };
}

describe('LongFrames', () => {
  it('sends the longest frame of a window, with what was on screen during it', () => {
    const { frames, sent, setNames, tick } = harness();
    setNames({ shown: 30, total: 400, turning: true });
    frames.observed([frame(100, 120), frame(200, 250)]);
    setNames({ shown: 400, total: 400, turning: false });
    frames.observed([frame(300, 110)]);
    expect(sent).toEqual([]);
    tick();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ name: 'long-animation-frame', startTime: 200, endTime: 450 });
    expect(sent[0]?.attributes).toMatchObject({
      'loaf.duration': 250,
      'app.names.shown': 30,
      'app.names.total': 400,
      'app.turning': true,
      'app.names.when': 'frame',
      'loaf.sent': 1,
    });
  });

  it('sends no frame under MIN_MS', () => {
    const { frames, sent, tick } = harness();
    frames.observed([frame(100, MIN_MS - 1)]);
    tick();
    expect(sent).toEqual([]);
  });

  it('sends at most MOST frames a page', () => {
    const { frames, sent, tick } = harness();
    for (let window = 0; window < MOST + 5; window += 1) {
      frames.observed([frame(window * WINDOW_MS, 200)]);
      tick();
    }
    expect(sent).toHaveLength(MOST);
  });

  it('gives the INP span its longest frame and the screen as it was then', () => {
    const { frames, setNames } = harness();
    const short = frame(1000, 60);
    const long = frame(1060, 140);
    setNames({ shown: 25, total: 380, turning: true });
    frames.observed([short, long]);
    setNames({ shown: 380, total: 380, turning: false });
    expect(frames.inpAttributes([short, long])).toMatchObject({
      'inp.loaf.count': 2,
      'inp.loaf.duration': 140,
      'inp.loaf.start_time': 1060,
      'app.names.shown': 25,
      'app.turning': true,
      'app.names.when': 'frame',
    });
  });

  it('gives the INP span the screen as reported when its frame is not known', () => {
    const { frames } = harness();
    expect(frames.inpAttributes([])).toEqual({
      'inp.loaf.count': 0,
      'app.names.shown': 300,
      'app.names.total': 400,
      'app.turning': false,
      'app.names.when': 'report',
    });
  });

  it('remembers the screen for the last frames only', () => {
    const { frames, setNames } = harness();
    setNames({ shown: 1, total: 1, turning: true });
    frames.observed([frame(0, 60)]);
    setNames({ shown: 2, total: 2, turning: false });
    frames.observed(Array.from({ length: 64 }, (_, index) => frame(100 + index * 100, 60)));
    expect(frames.inpAttributes([frame(0, 60)])['app.names.when']).toBe('report');
  });

  it('annotates an INP span from the metric web-vitals reports', () => {
    const { frames } = harness();
    const setAttributes = vi.fn();
    const long = frame(500, 200);
    frames.annotateInp({ attribution: { longAnimationFrameEntries: [long] } }, { setAttributes });
    expect(setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({ 'inp.loaf.count': 1, 'inp.loaf.duration': 200 }),
    );
  });
});

describe('inpFrames', () => {
  it('reads the long frames of an INP metric', () => {
    const long = frame(0, 120);
    expect(inpFrames({ attribution: { longAnimationFrameEntries: [long, { other: 1 }] } })).toEqual(
      [long],
    );
  });

  it('finds none in anything else', () => {
    expect(inpFrames(null)).toEqual([]);
    expect(inpFrames({ name: 'LCP' })).toEqual([]);
    expect(inpFrames({ attribution: null })).toEqual([]);
    expect(inpFrames({ attribution: {} })).toEqual([]);
    expect(inpFrames({ attribution: { longAnimationFrameEntries: 'no' } })).toEqual([]);
  });
});

describe('watchLongFrames', () => {
  /** A PerformanceObserver stand-in: `emit` delivers entries to the last one made. */
  function fakeObserver(supported: readonly string[]) {
    const observing: string[] = [];
    let deliver: ((entries: readonly unknown[]) => void) | null = null;
    const Observer: ObserverClass = class {
      static readonly supportedEntryTypes = supported;
      constructor(callback: (list: { getEntries(): readonly unknown[] }) => void) {
        deliver = (entries) => {
          callback({ getEntries: () => entries });
        };
      }
      observe({ type }: { type: string }): void {
        observing.push(type);
      }
    };
    return { Observer, observing, emit: (entries: readonly unknown[]) => deliver?.(entries) };
  }

  it('observes long animation frames where the browser has them', () => {
    const { frames, sent, tick } = harness();
    const fake = fakeObserver(['event', 'long-animation-frame']);
    expect(watchLongFrames(frames, fake.Observer)).toBe(true);
    expect(fake.observing).toEqual(['long-animation-frame']);
    fake.emit([frame(0, 300), { name: 'not a frame' }]);
    tick();
    expect(sent).toHaveLength(1);
  });

  it('starts from the page: its origin, its observer, its timers and the globe names', () => {
    noteScreenNames({ shown: 7, total: 90 }, true);
    const fake = fakeObserver(['long-animation-frame']);
    const sent: Attributes[] = [];
    const timers: (() => void)[] = [];
    startLongFrames(
      {
        startSpan(_name, { attributes }) {
          sent.push(attributes);
          return { end: vi.fn() };
        },
      },
      {
        location: { origin: ORIGIN },
        PerformanceObserver: fake.Observer,
        setTimeout: (run) => timers.push(run),
      },
    );
    fake.emit([frame(0, 300)]);
    for (const run of timers) run();
    expect(sent).toEqual([
      expect.objectContaining({ 'app.names.shown': 7, 'app.names.total': 90, 'app.turning': true }),
    ]);
  });

  it('does nothing where it has not', () => {
    const { frames } = harness();
    const fake = fakeObserver(['event']);
    expect(watchLongFrames(frames, fake.Observer)).toBe(false);
    expect(fake.observing).toEqual([]);
    expect(watchLongFrames(frames, undefined)).toBe(false);
  });
});
