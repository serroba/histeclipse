import { describe, expect, it } from 'vitest';
import { lookDirectionAt, toScene, unit } from './skyFrame';

describe('skyFrame', () => {
  it('turns east, north, up into the scene’s x, y and z (south)', () => {
    expect(toScene([1, 2, 3])).toEqual([1, 3, -2]);
  });

  it('points at an azimuth and altitude: due north on the horizon, and the zenith', () => {
    const [east, north, up] = lookDirectionAt(0, 0);
    expect(east).toBeCloseTo(0);
    expect(north).toBeCloseTo(1);
    expect(up).toBeCloseTo(0);
    expect(lookDirectionAt(123, 90)[2]).toBeCloseTo(1);
  });

  it('scales a vector to length one', () => {
    expect(unit([3, 0, 4])).toEqual([0.6, 0, 0.8]);
  });
});
