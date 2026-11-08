import { describe, expect, it } from 'vitest';

import { elevationAt, onLand, type ElevationGrid } from './landSea';

// Three columns (180° W, 0°, 180° E) and three rows (90° N, 0°, 90° S), from 10 m below.
const grid: ElevationGrid = {
  values: [10, 10, 10, 0, 30, 0, 10, 10, 10],
  columns: 3,
  rows: 3,
  lowest: -10,
};

describe('land or sea at a place', () => {
  it('reads the nearest node, north row first, from 180° W', () => {
    expect(elevationAt(grid, { latitude: 0, longitude: 0 })).toBe(20);
    expect(elevationAt(grid, { latitude: 0, longitude: -179 })).toBe(-10);
    expect(elevationAt(grid, { latitude: 89, longitude: 10 })).toBe(0);
  });

  it('wraps longitudes past 180° and keeps latitudes in the grid', () => {
    expect(elevationAt(grid, { latitude: 0, longitude: 360 })).toBe(20);
    expect(elevationAt(grid, { latitude: -95, longitude: 0 })).toBe(0);
  });

  it('calls above today’s sea level land', () => {
    expect(onLand(grid, { latitude: 0, longitude: 0 })).toBe(true);
    expect(onLand(grid, { latitude: 0, longitude: 179 })).toBe(false);
    expect(onLand(grid, { latitude: 90, longitude: 0 })).toBe(false);
  });
});
