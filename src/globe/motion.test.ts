import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { approachDirection, curve, localFrame } from './motion';

describe('curve', () => {
  const a = new Vector3(0, 0, 0);
  const c = new Vector3(1, 2, 0);
  const b = new Vector3(2, 0, 0);

  it('starts at a, ends at b, and bends towards c', () => {
    expect(curve(a, c, b, 0).toArray()).toEqual([0, 0, 0]);
    expect(curve(a, c, b, 1).toArray()).toEqual([2, 0, 0]);
    expect(curve(a, c, b, 0.5).toArray()).toEqual([1, 1, 0]);
  });

  it('leaves its points as they were', () => {
    curve(a, c, b, 0.3);
    expect(a.toArray()).toEqual([0, 0, 0]);
  });
});

describe('localFrame', () => {
  it('stands up, east and north at a place, at right angles', () => {
    const { up, east, north } = localFrame({ latitude: 0, longitude: 0 });
    expect(up.x).toBeCloseTo(1);
    expect(east.z).toBeCloseTo(-1);
    expect(north.y).toBeCloseTo(1);
    expect(up.dot(east)).toBeCloseTo(0);
    expect(east.dot(north)).toBeCloseTo(0);
  });

  it('still has an east at a pole', () => {
    const { up, east } = localFrame({ latitude: 90, longitude: 0 });
    expect(up.y).toBeCloseTo(1);
    expect(east.toArray()).toEqual([1, 0, 0]);
  });
});

describe('approachDirection', () => {
  const place = { latitude: 0, longitude: 0 };
  const { up, east, north } = localFrame(place);

  it('points straight up for a vertical approach, and level from where it came for a grazing one', () => {
    expect(approachDirection(place, 0, 90).distanceTo(up)).toBeLessThan(1e-9);
    expect(approachDirection(place, 0, 0).distanceTo(north)).toBeLessThan(1e-9);
    expect(approachDirection(place, 90, 0).distanceTo(east)).toBeLessThan(1e-9);
  });

  it('is a unit vector, between up and the horizon at 45°', () => {
    const from = approachDirection(place, 45, 45);
    expect(from.length()).toBeCloseTo(1, 9);
    expect(from.dot(up)).toBeCloseTo(Math.SQRT1_2, 9);
  });
});
