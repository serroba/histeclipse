import { describe, expect, it } from 'vitest';

import { CAMERA_DISTANCE_RANGE } from '../state/viewState';
import { distanceAt, distanceText, railPosition, ZOOM_STOPS } from './zoomRail';

describe('the zoom rail', () => {
  it('runs from the nearest the camera goes to the farthest, by the logarithm', () => {
    expect(railPosition(CAMERA_DISTANCE_RANGE.min)).toBe(0);
    expect(railPosition(CAMERA_DISTANCE_RANGE.max)).toBe(1);
    expect(
      railPosition(Math.sqrt(CAMERA_DISTANCE_RANGE.min * CAMERA_DISTANCE_RANGE.max)),
    ).toBeCloseTo(0.5);
    // Beyond the ends, it stays at the ends.
    expect(railPosition(0.5)).toBe(0);
    expect(railPosition(1e9)).toBe(1);
  });

  it('finds the distance at a place on the rail, the other way round', () => {
    for (const distance of [2, 60, 1000, 100_000]) {
      expect(distanceAt(railPosition(distance))).toBeCloseTo(distance, 6);
    }
    expect(distanceAt(-1)).toBeCloseTo(CAMERA_DISTANCE_RANGE.min);
  });

  it('names its stops nearest first, from Earth out to the planets', () => {
    const distances = ZOOM_STOPS.map((stop) => stop.distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(ZOOM_STOPS.map((stop) => stop.label)).toContain('Planets');
  });

  it('says how far in kilometres nearby, and in astronomical units far out', () => {
    expect(distanceText(3)).toBe('19,000 km from Earth');
    expect(distanceText(150)).toBe('960,000 km from Earth');
    expect(distanceText(60_000)).toBe('2.6 AU from Earth');
    expect(distanceText(300_000)).toBe('13 AU from Earth');
  });
});
