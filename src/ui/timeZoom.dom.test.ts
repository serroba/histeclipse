// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { ZOOM_STEP } from '../state/timeZoom';
import { createTimeZoom, sideways, wheelFactor } from './timeZoom';

/** A zoom control whose frames run when told, and the zooms it asked for. */
function zoomControl() {
  const zooms: number[] = [];
  const frames: (() => void)[] = [];
  const zoom = createTimeZoom(
    (factor) => zooms.push(factor),
    (run) => frames.push(run),
  );
  const track = document.createElement('div');
  zoom.attach(track);
  const frame = (): void => {
    for (const run of frames.splice(0)) run();
  };
  return { zoom, zooms, track, frame };
}

const buttons = (root: HTMLElement) => [...root.querySelectorAll('button')];

describe('zooming a time bar (#1074)', () => {
  it('Given − and +, When pressed, Then each zooms a step out or in', () => {
    const { zoom, zooms } = zoomControl();
    const [out, into] = buttons(zoom.root);
    out?.click();
    into?.click();
    expect(zooms).toEqual([ZOOM_STEP, 1 / ZOOM_STEP]);
    expect(out?.getAttribute('aria-label')).toBe('Show more time');
    expect(into?.getAttribute('aria-label')).toBe('Show less time');
  });

  it('Given no room, Then its button is off', () => {
    const { zoom } = zoomControl();
    zoom.render({ in: false, out: true });
    const [out, into] = buttons(zoom.root);
    expect(into?.disabled).toBe(true);
    expect(out?.disabled).toBe(false);
  });

  it('Given a burst of wheel events over the track, Then they zoom once a frame, by them all', () => {
    const { zooms, track, frame } = zoomControl();
    const wheel = (deltaY: number) =>
      new WheelEvent('wheel', { deltaY, cancelable: true, bubbles: true });
    const first = wheel(50);
    track.dispatchEvent(first);
    track.dispatchEvent(wheel(50));
    expect(first.defaultPrevented).toBe(true);
    expect(zooms).toEqual([]);
    frame();
    expect(zooms).toHaveLength(1);
    expect(zooms[0]).toBeCloseTo(wheelFactor({ deltaY: 100, deltaMode: 0 }), 9);
    expect(zooms[0]).toBeGreaterThan(1);
  });

  it('Given a sideways scroll, Then it does not zoom', () => {
    const { zooms, track, frame } = zoomControl();
    const sideways = new WheelEvent('wheel', { deltaX: 80, deltaY: 5, cancelable: true });
    track.dispatchEvent(sideways);
    frame();
    expect(zooms).toEqual([]);
    expect(sideways.defaultPrevented).toBe(false);
  });

  it('Given wheels by line and by page, Then they zoom about as a mouse notch, and no more than e', () => {
    expect(wheelFactor({ deltaY: 3, deltaMode: 1 })).toBeCloseTo(
      wheelFactor({ deltaY: 48, deltaMode: 0 }),
      9,
    );
    expect(wheelFactor({ deltaY: 5, deltaMode: 2 })).toBeCloseTo(Math.E, 9);
    expect(wheelFactor({ deltaY: -100, deltaMode: 0 })).toBeLessThan(1);
  });

  it('Given two fingers on the track, When they pinch together, Then it shows more time; one finger does nothing', () => {
    const { zooms, track, frame } = zoomControl();
    const touch = (type: string, ...xs: number[]) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: xs.map((clientX) => ({ clientX, clientY: 0 })),
      });
      track.dispatchEvent(event);
      return event;
    };
    touch('touchstart', 100);
    touch('touchmove', 120);
    frame();
    expect(zooms).toEqual([]);
    touch('touchstart', 100, 300);
    const pinch = touch('touchmove', 150, 250);
    expect(pinch.defaultPrevented).toBe(true);
    frame();
    expect(zooms).toHaveLength(1);
    expect(zooms[0]).toBeCloseTo(2, 9);
  });

  it('Given the page’s own frames, Then a wheel zooms on the next one', async () => {
    const zooms: number[] = [];
    const zoom = createTimeZoom((factor) => zooms.push(factor));
    const track = document.createElement('div');
    zoom.attach(track);
    track.dispatchEvent(new WheelEvent('wheel', { deltaY: -40, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(zooms).toHaveLength(1);
    expect(zooms[0]).toBeLessThan(1);
  });
});

describe('panning a time bar (#749)', () => {
  /** A track 400 px wide, panning and zooming, its frames run when told. */
  function panControl() {
    const zooms: number[] = [];
    const pans: number[] = [];
    const frames: (() => void)[] = [];
    const zoom = createTimeZoom(
      (factor) => zooms.push(factor),
      (run) => frames.push(run),
    );
    const track = document.createElement('div');
    Object.defineProperty(track, 'clientWidth', { value: 400 });
    zoom.attach(track, (share) => pans.push(share));
    const frame = (): void => {
      for (const run of frames.splice(0)) run();
    };
    return { zooms, pans, track, frame };
  }

  it('Given a sideways scroll, or Shift and the wheel, Then the window slides by its share, once a frame', () => {
    expect(sideways({ deltaX: 30, deltaY: 4, shiftKey: false })).toBe(30);
    expect(sideways({ deltaX: 0, deltaY: 40, shiftKey: true })).toBe(40);
    expect(sideways({ deltaX: 0, deltaY: 40, shiftKey: false })).toBe(0);
    const { zooms, pans, track, frame } = panControl();
    const swipe = new WheelEvent('wheel', { deltaX: 40, deltaY: 2, cancelable: true });
    track.dispatchEvent(swipe);
    const shifted = new WheelEvent('wheel', { deltaY: -20, cancelable: true });
    Object.defineProperty(shifted, 'shiftKey', { value: true });
    track.dispatchEvent(shifted);
    expect(swipe.defaultPrevented).toBe(true);
    frame();
    expect(zooms).toEqual([]);
    expect(pans).toHaveLength(1);
    // A tenth later, then a twentieth earlier: gathered into one.
    expect(pans[0]).toBeCloseTo(0.05, 9);
    track.dispatchEvent(new WheelEvent('wheel', { deltaX: -100, cancelable: true }));
    frame();
    expect(pans[1]).toBeCloseTo(-0.25, 9);
  });

  it('Given two fingers moved together along the track, Then the window is dragged with them', () => {
    const { zooms, pans, track, frame } = panControl();
    const touch = (type: string, ...xs: number[]) => {
      const event = new Event(type, { cancelable: true });
      Object.defineProperty(event, 'touches', {
        value: xs.map((clientX) => ({ clientX, clientY: 0 })),
      });
      track.dispatchEvent(event);
    };
    touch('touchstart', 100, 200);
    touch('touchmove', 200, 300);
    frame();
    // Moved right a quarter of the track, the same apart: earlier by a quarter, no zoom.
    expect(zooms).toEqual([]);
    expect(pans).toHaveLength(1);
    expect(pans[0]).toBeCloseTo(-0.25, 9);
  });
});
