import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';

import { CALLOUT, globeOnScreen, ringPlaces, spread, type GlobeOnScreen } from './callouts';

const globe: GlobeOnScreen = { x: 400, y: 300, radius: 200, width: 800, height: 600 };
const ring = globe.radius + CALLOUT.out;

describe('where the globe lies on screen', () => {
  it('is in the middle of the page for a camera looking at it, its edge where the limb is', () => {
    const camera = new PerspectiveCamera(40, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 4);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const seen = globeOnScreen(camera, 800, 600);
    expect(seen.x).toBeCloseTo(400, 3);
    expect(seen.y).toBeCloseTo(300, 3);
    // A unit sphere from 4 radii: its limb at asin(1/4) from the axis, in a 40° view 600 high.
    const expected = (Math.tan(Math.asin(1 / 4)) / Math.tan((20 * Math.PI) / 180)) * 300;
    expect(seen.radius).toBeCloseTo(expected, 1);
    expect(seen.width).toBe(800);
    expect(seen.height).toBe(600);
  });

  it('is wider from nearer, and holds for a camera at the surface', () => {
    const at = (distance: number): number => {
      const camera = new PerspectiveCamera(40, 1, 0.01, 100);
      camera.position.set(0, 0, distance);
      camera.updateMatrixWorld();
      return globeOnScreen(camera, 600, 600).radius;
    };
    expect(at(2)).toBeGreaterThan(at(4));
    expect(Number.isFinite(at(1))).toBe(true);
  });
});

describe('spreading the pictures round the globe', () => {
  it('leaves angles alone that are far enough apart, and one or none as they are', () => {
    expect(spread([0, 1, 2], 0.5)).toEqual([0, 1, 2]);
    expect(spread([1], 0.5)).toEqual([1]);
    expect(spread([], 0.5)).toEqual([]);
  });

  it('pushes crowded neighbours apart, keeping their order and their middle', () => {
    const [a = 0, b = 0, c = 0] = spread([1, 1.05, 1.1], 0.3);
    expect(b - a).toBeGreaterThanOrEqual(0.3 - 1e-3);
    expect(c - b).toBeGreaterThanOrEqual(0.3 - 1e-3);
    expect((a + c) / 2).toBeCloseTo(1.05, 1);
  });

  it('keeps the last and the first apart across the whole turn', () => {
    const [first = 0, last = 0] = spread([-3.1, 3.1], 0.5);
    expect(first + 2 * Math.PI - last).toBeGreaterThanOrEqual(0.5 - 1e-3);
  });
});

describe('where each picture stands', () => {
  it('is on the ring outside the globe, towards its dot', () => {
    const [east, north] = ringPlaces(globe, [
      { x: 500, y: 300 },
      { x: 400, y: 150 },
    ]);
    expect(east).toEqual({ x: 400 + ring, y: 300 });
    expect(north?.x).toBeCloseTo(400, 6);
    expect(north?.y).toBeCloseTo(300 - ring, 6);
  });

  it('answers in the order the dots were given, whatever their order round the globe', () => {
    const [south, west] = ringPlaces(globe, [
      { x: 400, y: 400 },
      { x: 300, y: 300 },
    ]);
    expect(south?.y).toBeGreaterThan(globe.y);
    expect(west?.x).toBeLessThan(globe.x);
  });

  it('stands pictures of dots close together apart from each other', () => {
    const [a, b] = ringPlaces(globe, [
      { x: 500, y: 300 },
      { x: 500, y: 302 },
    ]);
    expect(Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.y ?? 0) - (b?.y ?? 0))).toBeGreaterThan(
      CALLOUT.width,
    );
  });

  it('keeps every picture on the page where the globe fills it', () => {
    const filling: GlobeOnScreen = { x: 200, y: 150, radius: 400, width: 400, height: 300 };
    const places = ringPlaces(filling, [
      { x: 390, y: 150 },
      { x: 10, y: 150 },
      { x: 200, y: 10 },
      { x: 200, y: 290 },
    ]);
    for (const place of places) {
      expect(place.x).toBeGreaterThanOrEqual(CALLOUT.width / 2);
      expect(place.x).toBeLessThanOrEqual(400 - CALLOUT.width / 2);
      expect(place.y).toBeGreaterThanOrEqual(CALLOUT.height / 2);
      expect(place.y).toBeLessThanOrEqual(300 - CALLOUT.height / 2);
    }
  });

  it('stands none for no dots', () => {
    expect(ringPlaces(globe, [])).toEqual([]);
  });
});
