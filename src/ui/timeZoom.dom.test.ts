// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { ZOOM_STEP } from '../state/timeZoom';
import { createTimeZoom, wheelFactor } from './timeZoom';

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
});
