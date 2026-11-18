import { Box3, Group, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { array, ground, groundRing, materials, strut } from './kit';

const box = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
};
const size = (object: Object3D): Vector3 => box(object).getSize(new Vector3());

describe('the kit the telescopes are built with (#859)', () => {
  const kit = materials();

  it('Given a strut between two points, Then it spans them', () => {
    const made = strut(new Vector3(0, 0, 0), new Vector3(0, 10, 0), 1, kit.steel);
    expect(size(made).y).toBeCloseTo(10, 5);
    const slanted = strut(new Vector3(0, 0, 0), new Vector3(3, 0, 4), 0.1, kit.steel);
    expect(size(slanted).length()).toBeGreaterThan(5);
    expect(size(slanted).length()).toBeLessThan(5.2);
  });

  it('Given places east and north, Then a copy stands at each, north being -Z', () => {
    const made = array(
      [
        [10, 0],
        [0, 20],
      ],
      () => new Group(),
    );
    expect(made.children.map(({ position }) => position.toArray())).toEqual([
      [10, 0, -0],
      [0, 0, -20],
    ]);
  });

  it('Given ground, Then a disc is as wide as asked, its top at y = 0; a ring leaves its hole', () => {
    expect(size(ground(100, kit)).x).toBeCloseTo(100, 5);
    expect(box(ground(100, kit)).max.y).toBeCloseTo(0, 6);
    const ring = groundRing(40, 100, kit);
    expect(size(ring).x).toBeCloseTo(100, 5);
    expect(size(ring).y).toBeCloseTo(0, 5);
  });
});
