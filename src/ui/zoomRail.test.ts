import { describe, expect, it } from 'vitest';

import {
  CAMERA_DISTANCE_RANGE,
  defaultViewState,
  nearestDistance,
  type Body,
} from '../state/viewState';
import {
  distanceAt,
  distanceText,
  railPosition,
  railScale,
  snappedDistance,
  stopsFor,
} from './zoomRail';
import { railView } from './railView';

/** The rail for `body` on a device that takes on Earth's tiles. */
const rail = (body: Body): ReturnType<typeof railScale> =>
  railScale(body, nearestDistance(body, true));
const earth = rail('earth');

describe('the zoom rail', () => {
  it('runs from the nearest the camera goes to the farthest, by the logarithm', () => {
    expect(railPosition(CAMERA_DISTANCE_RANGE.min, earth)).toBe(0);
    expect(railPosition(CAMERA_DISTANCE_RANGE.max, earth)).toBe(1);
    expect(
      railPosition(Math.sqrt(CAMERA_DISTANCE_RANGE.min * CAMERA_DISTANCE_RANGE.max), earth),
    ).toBeCloseTo(0.5);
    // Beyond the ends, it stays at the ends.
    expect(railPosition(0.5, earth)).toBe(0);
    expect(railPosition(1e9, earth)).toBe(1);
  });

  it('finds the distance at a place on the rail, the other way round', () => {
    for (const distance of [2, 60, 1000, 100_000]) {
      expect(distanceAt(railPosition(distance, earth), earth)).toBeCloseTo(distance, 6);
    }
    expect(distanceAt(-1, earth)).toBeCloseTo(CAMERA_DISTANCE_RANGE.min);
  });

  it('reaches as far round each body as the camera does, in that body’s radii', () => {
    // The scene caps the camera at 300,000 Earth radii, whatever the body.
    const sun = rail('sun');
    expect(sun.far * sun.radiusKm).toBeCloseTo(earth.far * earth.radiusKm, -3);
    // A body smaller than Earth reaches 300,000 of its own radii.
    expect(rail('moon').far).toBe(CAMERA_DISTANCE_RANGE.max);
  });

  it('comes down to about 50 km over Earth, and as near as before to the other bodies', () => {
    expect(earth.near).toBe(1.008);
    expect((earth.near - 1) * earth.radiusKm).toBeCloseTo(51, 0);
    for (const body of ['moon', 'sun', 'mars', 'jupiter', 'titan'] as const) {
      expect(rail(body).near).toBe(1.05);
    }
  });

  it('comes no nearer Earth than 1.05 radii, about 320 km, on graphics without its tiles', () => {
    const untiled = railScale('earth', nearestDistance('earth', false));
    expect(untiled.near).toBe(1.05);
    expect(railPosition(1.05, untiled)).toBe(0);
    expect(distanceAt(0, untiled)).toBeCloseTo(1.05);
    expect(nearestDistance('moon', false)).toBe(1.05);
  });

  it('gives each body the stops within reach, its own first', () => {
    const labels = (body: Body): string[] => stopsFor(rail(body)).map((stop) => stop.label);
    expect(labels('earth')).toEqual(['Earth', 'Moon', 'Planets', 'Saturn']);
    expect(labels('sun')).toEqual(['Sun', 'Planets', 'Saturn']);
    expect(labels('moon')).toEqual(['Moon', 'With Earth', 'Planets']);
    expect(labels('mars')).toEqual(['Mars', 'Planets']);
    for (const body of ['earth', 'sun', 'moon', 'jupiter'] as const) {
      const distances = stopsFor(rail(body)).map((stop) => stop.distance);
      expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    }
  });

  it('says how far, from the body in focus, in kilometres nearby and AU far out', () => {
    expect(distanceText(3, earth)).toBe('19,000 km from Earth');
    expect(distanceText(150, earth)).toBe('960,000 km from Earth');
    expect(distanceText(60_000, earth)).toBe('2.6 AU from Earth');
    expect(distanceText(300_000, earth)).toBe('13 AU from Earth');
    expect(distanceText(3, rail('sun'))).toBe('2,100,000 km from the Sun');
    expect(distanceText(3, rail('mars'))).toBe('10,000 km from Mars');
  });

  it('settles on a stop when the slider comes near it, and goes between them otherwise', () => {
    const planets = stopsFor(earth).find((stop) => stop.label === 'Planets');
    if (planets === undefined) throw new Error('no Planets stop');
    const at = railPosition(planets.distance, earth);
    expect(snappedDistance(at + 0.05, earth)).toBe(planets.distance);
    expect(snappedDistance(at - 0.05, earth)).toBe(planets.distance);
    expect(snappedDistance(0.6, earth)).toBeCloseTo(distanceAt(0.6, earth));
  });
});

describe('the rail for the view', () => {
  const base = defaultViewState(new Date(Date.UTC(2024, 3, 8)));
  it('shows on the globe looked at freely, in the years, from the body in focus', () => {
    const free = { ...base, view: 'free' as const, focus: 'moon' as const };
    expect(railView(free, true)).toEqual({
      body: 'moon',
      distance: base.camera.distance,
      near: 1.05,
    });
    expect(railView({ ...free, mode: 'sky' }, true)).toBeNull();
    expect(railView({ ...free, view: 'moon-from-earth' }, true)).toBeNull();
    expect(railView({ ...free, ma: 66 }, true)).toBeNull();
  });

  it('comes down as near over Earth as the device lets the camera', () => {
    const earth = { ...base, view: 'free' as const, focus: 'earth' as const };
    expect(railView(earth, true)?.near).toBe(1.008);
    expect(railView(earth, false)?.near).toBe(1.05);
  });
});
