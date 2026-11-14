import { afterEach, describe, expect, it, vi } from 'vitest';
import { animationLoop, type AnimationScheduler } from '../util/animationLoop';
import { playhead } from '../deepTime/playhead';
import { yearPlayhead } from '../time/yearPlay';

function display() {
  let time = 0;
  let id = 0;
  const callbacks = new Map<number, (now: number) => void>();
  const scheduler: AnimationScheduler = {
    now: () => time,
    request(callback) {
      callbacks.set(++id, callback);
      return id;
    },
    cancel(key) {
      callbacks.delete(key);
    },
  };
  function frame(now: number) {
    time = now;
    const due = [...callbacks.values()];
    callbacks.clear();
    for (const callback of due) callback(now);
  }
  return {
    scheduler,
    callbacks,
    frame,
    setTime: (now: number) => {
      time = now;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('scheduled playback, with an explicit frame clock', () => {
  it.each([30, 60, 120, 144, 240])('moves both time players correctly at %i Hz', (hz) => {
    const d = display();
    const deep = playhead();
    const years = yearPlayhead();
    let ma = 1;
    let year = 0;
    const loop = animationLoop(
      (seconds) => {
        ma = deep.step(ma, 0.05, seconds);
      },
      0,
      d.scheduler,
    );
    const historical = animationLoop(
      (seconds) => {
        year = years.step(year, 50, seconds, 2026);
      },
      0.08,
      d.scheduler,
    );
    loop.start();
    historical.start();
    for (let i = 1; i <= hz * 2; i++) d.frame((i * 1000) / hz);
    expect(ma).toBeCloseTo(0.9, 3);
    // Historical updates are throttled to 80 ms, leaving at most one interval unshown.
    expect(year).toBeGreaterThanOrEqual(96);
    expect(year).toBeLessThanOrEqual(100);
    loop.stop();
    historical.stop();
    expect(d.callbacks.size).toBe(0);
  });

  it('starts once, pauses without accumulating paused time, and rejects a stale frame', () => {
    const d = display();
    const steps: number[] = [];
    const loop = animationLoop(
      (seconds) => {
        steps.push(seconds);
      },
      0,
      d.scheduler,
    );
    loop.stop();
    loop.start();
    loop.start();
    expect(d.callbacks.size).toBe(1);
    d.frame(100);
    const stale = [...d.callbacks.values()][0];
    loop.stop();
    loop.stop();
    d.setTime(10_000);
    loop.start();
    stale?.(20_000);
    expect(steps).toEqual([0.1]);
    d.frame(10_100);
    expect(steps).toEqual([0.1, 0.1]);
    loop.stop();
  });

  it('does not queue after a step stops or double-queue when it restarts', () => {
    const d = display();
    let calls = 0;
    const loop = animationLoop(
      () => {
        calls++;
        loop.stop();
        if (calls === 1) loop.start();
      },
      0,
      d.scheduler,
    );
    loop.start();
    d.frame(100);
    expect(d.callbacks.size).toBe(1);
    d.frame(200);
    expect(d.callbacks.size).toBe(0);
  });

  it('carries elapsed time through throttle intervals and ignores backward timestamps', () => {
    const d = display();
    const step = vi.fn();
    const loop = animationLoop(step, 0.08, d.scheduler);
    loop.start();
    d.frame(40);
    d.frame(79);
    expect(step).not.toHaveBeenCalled();
    d.frame(100);
    expect(step).toHaveBeenLastCalledWith(0.1);
    d.frame(50);
    d.frame(180);
    expect(step).toHaveBeenLastCalledWith(0.08);
    loop.stop();
  });

  it('uses browser scheduling by default and can stop inside a running frame', () => {
    const d = display();
    vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) =>
      d.scheduler.request(callback),
    );
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      d.scheduler.cancel(id);
    });
    const loop = animationLoop(() => {
      loop.stop();
    });
    loop.start();
    d.frame(performance.now() + 10);
    expect(d.callbacks.size).toBe(0);
    loop.start();
    loop.stop();
    expect(d.callbacks.size).toBe(0);
  });
});
