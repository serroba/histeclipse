import { describe, expect, it, vi } from 'vitest';

import { PLAYBACK_EVENT, signalPlayback, type PlaybackSignal } from '../util/playbackSignal';
import { frameStats, MOST, PlaybackFrames, startPlaybackWatch } from './playback';

/** Frames run by hand, `ms` apart; and the spans sent. */
function fakes() {
  let waiting: ((now: number) => void)[] = [];
  let now = 0;
  const spans: { name: string; attributes: Record<string, unknown>; ms: number }[] = [];
  const clock = {
    requestAnimationFrame: (run: (now: number) => void) => {
      waiting.push(run);
      return waiting.length;
    },
    cancelAnimationFrame: vi.fn(() => {
      waiting = [];
    }),
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
