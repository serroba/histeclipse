import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { curve, localFrame } from './motion';

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
