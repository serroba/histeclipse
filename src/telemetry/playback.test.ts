import { describe, expect, it, vi } from 'vitest';

import { PLAYBACK_EVENT, signalPlayback, type PlaybackSignal } from '../util/playbackSignal';
import { frameStats, MOST, PlaybackFrames, startPlaybackWatch, workStats } from './playback';

/** Frames run by hand, `ms` apart, each with `work` ms of main-thread work; and the spans sent. */
function fakes(work = 5) {
  let waiting: ((now: number) => void)[] = [];
  let after: (() => void)[] = [];
  let now = 0;
  let clockNow = 0;
  const spans: { name: string; attributes: Record<string, unknown>; ms: number }[] = [];
  const clock = {
    requestAnimationFrame: (run: (now: number) => void) => {
      waiting.push(run);
      return waiting.length;
    },
    cancelAnimationFrame: vi.fn(() => {
      waiting = [];
    }),
    afterFrame: (run: () => void) => {
      after.push(run);
    },
    now: () => clockNow,
  };
  const tracer = {
    startSpan: (name: string, options: { startTime: number; attributes: object }) => ({
      end: (end: number) => {
        spans.push({
          name,
          attributes: options.attributes as Record<string, unknown>,
          ms: end - options.startTime,
        });
      },
    }),
  };
  const frames = (...gaps: number[]): void => {
    for (const gap of [0, ...gaps]) {
      now += gap;
      const run = waiting;
      waiting = [];
      for (const each of run) each(now);
      clockNow = now + work;
      const then = after;
      after = [];
      for (const each of then) each();
    }
  };
  return { clock, tracer, spans, frames };
}

const start: PlaybackSignal = { phase: 'start', kind: 'launches', detail: { startPace: 50 } };
const stop: PlaybackSignal = {
  phase: 'stop',
  kind: 'launches',
  detail: { reason: 'stopped', slowdowns: 2 },
};

describe('how smooth play was (#764)', () => {
  it('Given the gaps between frames, Then how many, typical, tail and worst, and how many slow', () => {
    const gaps = [...Array.from({ length: 97 }, () => 16.7), 40, 60, 120];
    expect(frameStats(gaps)).toMatchObject({
      'playback.frames': 100,
      'playback.gap_p50_ms': 16.7,
      'playback.gap_max_ms': 120,
      'playback.gaps_over_34ms': 3,
      'playback.gaps_over_50ms': 2,
      'playback.gaps_over_100ms': 1,
    });
    expect(frameStats([])).toEqual({ 'playback.frames': 0 });
  });

  it('Given each frame’s main-thread work, Then typical, tail, worst, and how many overran 90 and 60 Hz', () => {
    const work = [...Array.from({ length: 18 }, () => 6), 12, 20];
    expect(workStats(work)).toEqual({
      'playback.work_p50_ms': 6,
      'playback.work_p95_ms': 20,
      'playback.work_max_ms': 20,
      'playback.work_over_11ms': 2,
      'playback.work_over_17ms': 1,
    });
    expect(workStats([])).toEqual({});
  });

  it('Given work timed after play stopped, Then it is not counted', () => {
    const { clock, tracer, spans, frames } = fakes(14);
    const late: (() => void)[] = [];
    const watch = new PlaybackFrames(tracer, {
      ...clock,
      afterFrame: (run) => {
        late.push(run);
      },
    });
    watch.signalled(start);
    frames(16);
    watch.signalled(stop);
    for (const run of late) run();
    expect(late).toHaveLength(2);
    expect(spans[0]?.attributes['playback.frames']).toBe(1);
    expect(spans[0]?.attributes).not.toHaveProperty('playback.work_p50_ms');
  });

  it('Given a play from start to stop, Then one span, with what the player said and its frames', () => {
    const { clock, tracer, spans, frames } = fakes();
    const watch = new PlaybackFrames(tracer, clock);
    watch.signalled(start);
    frames(16, 17, 50);
    watch.signalled(stop);
    expect(clock.cancelAnimationFrame).toHaveBeenCalled();
    expect(spans).toHaveLength(1);
    expect(spans[0]).toMatchObject({ name: 'playback', ms: 83 });
    expect(spans[0]?.attributes).toMatchObject({
      'playback.kind': 'launches',
      'playback.startPace': 50,
      'playback.reason': 'stopped',
      'playback.slowdowns': 2,
      'playback.frames': 3,
      'playback.gaps_over_34ms': 1,
      'playback.seconds': 0.083,
      'playback.sent': 1,
      'playback.gap_min_ms': 16,
      'playback.work_p50_ms': 5,
      'playback.work_over_11ms': 0,
    });
  });

  it('Given the page hidden, or play started again, Then the play so far is sent; a stop with none playing sends nothing', () => {
    const { clock, tracer, spans, frames } = fakes();
    const watch = new PlaybackFrames(tracer, clock);
    watch.signalled(stop);
    watch.signalled(start);
    frames(16);
    watch.signalled(start);
    frames(16);
    watch.hidden();
    watch.hidden();
    expect(spans.map(({ attributes }) => attributes['playback.reason'])).toEqual([
      'restarted',
      'hidden',
    ]);
  });

  it('Given a play with no frame drawn, or past the most a page, Then nothing is sent', () => {
    const { clock, tracer, spans, frames } = fakes();
    const watch = new PlaybackFrames(tracer, clock);
    watch.signalled(start);
    watch.signalled(stop);
    expect(spans).toHaveLength(0);
    for (let k = 0; k < MOST + 2; k += 1) {
      watch.signalled(start);
      frames(16);
      watch.signalled(stop);
    }
    expect(spans).toHaveLength(MOST);
  });

  it('Given the page, Then its signals and its hiding reach the watch', () => {
    const { clock, tracer, spans, frames } = fakes();
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const page = Object.assign(new EventTarget(), clock, { document });
    startPlaybackWatch(tracer, page);
    signalPlayback(start, page);
    frames(16);
    page.dispatchEvent(new Event(PLAYBACK_EVENT));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(spans).toHaveLength(0);
    document.visibilityState = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(spans[0]?.attributes['playback.reason']).toBe('hidden');
  });
});
