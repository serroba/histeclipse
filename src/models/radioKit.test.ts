import { Box3, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { materials } from './kit';
import { bowl, dish, dishDepth, dishWithFeed, steerable } from './radioKit';

const box = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
};
const size = (object: Object3D): Vector3 => box(object).getSize(new Vector3());

describe('the radio telescopes’ parts (#859, #877)', () => {
  const kit = materials();

  it('Given a dish 64 m across at f/D 0.41, Then it is 64 m across and r²/4f deep, its vertex at the origin', () => {
    const made = dish(64, 0.41, kit.dish);
    const { x, y, z } = size(made);
    expect(x).toBeCloseTo(64, 1);
    expect(z).toBeCloseTo(64, 1);
    expect(y).toBeCloseTo(dishDepth(64, 0.41), 5);
    expect(dishDepth(64, 0.41)).toBeCloseTo((32 * 32) / (4 * 0.41 * 64), 9);
    expect(box(made).min.y).toBeCloseTo(0, 9);
  });

  it('Given its feed, Then the feed sits at the focus, f/D diameters up', () => {
    const made = dishWithFeed(25, 0.4, 4, kit);
    expect(box(made).max.y).toBeCloseTo(10 + 25 * 0.025, 5);
  });

  it('Given a steerable dish, Then its rail is as wide as asked and its axis as high', () => {
    const made = steerable(
      {
        diameter: 76.2,
        focalRatio: 0.3,
        axisHeight: 50.5,
        railDiameter: 107.5,
        elevationDeg: 90,
        legs: 4,
      },
      kit,
    );
    expect(size(made).x).toBeCloseTo(107.5, 0);
    // Pointing at the zenith: its rim's plane on the axis, its focus 0.3 diameters above the vertex.
    expect(box(made).max.y).toBeCloseTo(50.5 - dishDepth(76.2, 0.3) + 0.3 * 76.2 + 76.2 * 0.025, 0);
  });

  it('Given Lovell’s sizes facing the horizon, Then its rim reaches its published 89.0 m', () => {
    const made = steerable(
      {
        diameter: 76.2,
        focalRatio: 0.3,
        axisHeight: 50.5,
        railDiameter: 107.5,
        elevationDeg: 0,
        legs: 4,
      },
      kit,
    );
    expect(box(made).max.y).toBeCloseTo(89, 0);
  });

  it('Given a bowl 305 m across and 51 m deep, Then its rim is at y = 0 and its floor 51 m down', () => {
    const made = bowl(305, 51, kit.dish);
    expect(size(made).x).toBeCloseTo(305, 1);
    expect(box(made).max.y).toBeCloseTo(0, 5);
    expect(box(made).min.y).toBeCloseTo(-51, 5);
  });
});
