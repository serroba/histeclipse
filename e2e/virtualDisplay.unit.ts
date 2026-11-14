// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installVirtualDisplay } from './virtualDisplay';

let originalNow: PropertyDescriptor | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  originalNow = Object.getOwnPropertyDescriptor(performance, 'now');
  vi.stubGlobal('requestAnimationFrame', window.requestAnimationFrame.bind(window));
  vi.stubGlobal('cancelAnimationFrame', window.cancelAnimationFrame.bind(window));
});
afterEach(() => {
  if (originalNow === undefined) Reflect.deleteProperty(performance, 'now');
  else Object.defineProperty(performance, 'now', originalNow);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the virtual browser display fixture', () => {
  it('batches callbacks at one timestamp on the same clock as performance.now', () => {
    installVirtualDisplay(120);
    const start = performance.now();
    const frames: number[] = [];
    requestAnimationFrame((now) => {
      frames.push(now);
      expect(now).toBe(performance.now());
    });
    requestAnimationFrame((now) => {
      frames.push(now);
    });
    vi.advanceTimersByTime(9);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toBe(frames[1]);
    expect((frames[0] ?? 0) - start).toBeCloseTo(1000 / 120);
  });

  it('can cancel a scheduled frame without advancing virtual time', () => {
    installVirtualDisplay(120);
    const start = performance.now();
    const callback = vi.fn();
    const id = requestAnimationFrame(callback);
    cancelAnimationFrame(id);
    vi.advanceTimersByTime(1000);
    expect(callback).not.toHaveBeenCalled();
    expect(performance.now()).toBe(start);
    cancelAnimationFrame(-1);
  });

  it('can cancel another callback from inside the same frame', () => {
    installVirtualDisplay(60);
    let second = 0;
    const callback = vi.fn();
    requestAnimationFrame(() => {
      cancelAnimationFrame(second);
    });
    second = requestAnimationFrame(callback);
    vi.advanceTimersByTime(17);
    expect(callback).not.toHaveBeenCalled();
  });

  it('schedules work requested during a frame on the next frame and preserves other callbacks', () => {
    installVirtualDisplay(60);
    const frames: number[] = [];
    requestAnimationFrame((now) => {
      frames.push(now);
      requestAnimationFrame((next) => {
        frames.push(next);
      });
    });
    const cancelled = requestAnimationFrame(() => {
      throw new Error('cancelled');
    });
    cancelAnimationFrame(cancelled);
    vi.advanceTimersByTime(17);
    expect(frames).toHaveLength(1);
    vi.advanceTimersByTime(17);
    expect(frames).toHaveLength(2);
    expect((frames[1] ?? 0) - (frames[0] ?? 0)).toBeCloseTo(1000 / 60);
  });
});
