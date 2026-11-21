import { describe, expect, it, vi } from 'vitest';
import type { MoonEphemeris } from '../../astro/moon';
import { defaultViewState, withLayer, type ViewState } from '../../state/viewState';
import { createMoon, moonWanted, nearNewMoon } from './moon';

/** A view on 17 November 2026 (a waxing crescent): Earth close up, no layer. */
const first: ViewState = defaultViewState(new Date('2026-11-17T12:00:00Z'));

const never = (): Promise<MoonEphemeris> => new Promise<MoonEphemeris>(() => undefined);

describe("the Moon's theory", () => {
  it('is null until it arrives, then says so', async () => {
    const theory = { position: () => [0, 0, 0] } as unknown as MoonEphemeris;
    const arrived = vi.fn();
    const notify = vi.fn();
    const moon = createMoon(
      { moonArrived: arrived, notify },
      () => Promise.resolve(theory),
      new EventTarget(),
    );
    expect(moon.ephemeris()).toBeNull();
    moon.load();
    await vi.waitFor(() => {
      expect(arrived).toHaveBeenCalledOnce();
    });
    // The theory, its last few moments kept (#766).
    expect(moon.ephemeris()?.position(0 as never)).toEqual([0, 0, 0]);
    expect(notify).not.toHaveBeenCalled();
  });

  it('tells the reader when it cannot load, and tries again when asked', async () => {
    const arrived = vi.fn();
    const notify = vi.fn();
    const loader = vi.fn(() => Promise.reject(new Error('offline')));
    const moon = createMoon({ moonArrived: arrived, notify }, loader, new EventTarget());
    moon.load();
    await vi.waitFor(() => {
      expect(notify).toHaveBeenCalledWith("Could not load the Moon's orbit: offline");
    });
    expect(moon.ephemeris()).toBeNull();
    expect(arrived).not.toHaveBeenCalled();
    moon.load();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('is fetched once, however often it is asked for (#981)', () => {
    const loader = vi.fn(never);
    const moon = createMoon({ moonArrived: vi.fn(), notify: vi.fn() }, loader, new EventTarget());
    moon.load();
    moon.load();
    expect(loader).toHaveBeenCalledOnce();
  });

  it('comes with the reader’s first touch or scroll on the globe: the view is about to move (#981)', () => {
    const touched = new EventTarget();
    const loader = vi.fn(never);
    createMoon({ moonArrived: vi.fn(), notify: vi.fn() }, loader, touched);
    expect(loader).not.toHaveBeenCalled();
    touched.dispatchEvent(new Event('wheel'));
    touched.dispatchEvent(new Event('pointerdown'));
    expect(loader).toHaveBeenCalledOnce();
  });
});

describe('when the view needs the Moon (#981)', () => {
  it('Given the first view, Earth close up on a day with no layer, Then not yet', () => {
    expect(moonWanted(first)).toBe(false);
  });

  it('Given the sky, a viewpoint, another body, the view far out, or craft or eclipses, Then yes', () => {
    expect(moonWanted({ ...first, mode: 'sky' })).toBe(true);
    expect(moonWanted({ ...first, view: 'moon-from-earth' })).toBe(true);
    expect(moonWanted({ ...first, focus: 'moon' })).toBe(true);
    expect(moonWanted({ ...first, camera: { ...first.camera, distance: 60 } })).toBe(true);
    expect(moonWanted({ ...first, layers: withLayer(first.layers, 'spacecraft', true) })).toBe(
      true,
    );
    expect(moonWanted({ ...first, layers: withLayer(first.layers, 'eclipses', true) })).toBe(true);
  });

  it('Given deep time, Then no', () => {
    expect(moonWanted({ ...first, mode: 'sky', ma: 250 })).toBe(false);
  });

  it('Given a day by a new Moon, when an eclipse may darken Earth, Then yes', () => {
    // The total eclipse of 8 April 2024, 18:17 UT: JD 2460409.26.
    expect(nearNewMoon(2_460_409.26)).toBe(true);
    // A week later, the first quarter.
    expect(nearNewMoon(2_460_416.26)).toBe(false);
    // The eclipse of Thales, 28 May 585 BCE (Julian), JD 1507900.1: as far back, still found.
    expect(nearNewMoon(1_507_900.1)).toBe(true);
  });
});
