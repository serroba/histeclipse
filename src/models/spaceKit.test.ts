import { Box3, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import { materials } from './kit';
import { body, cone, disc, ellipse, panel, wings } from './spaceKit';

const size = (object: Object3D): Vector3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object).getSize(new Vector3());
};

describe('the space telescopes’ parts (#861)', () => {
  const kit = materials();

  it('Given a panel, a body, a disc and a cone, Then each is the size asked', () => {
    const flat = size(panel(2, 3, kit.solar));
    expect(flat.x).toBeCloseTo(2, 5);
    expect(flat.y).toBeCloseTo(0.04, 5);
    expect(flat.z).toBeCloseTo(3, 5);
    const made = body(2, 4, kit.steel, { sides: 8, base: 1 });
    expect(new Box3().setFromObject(made).min.y).toBeCloseTo(1, 9);
    expect(size(made).y).toBeCloseTo(4, 9);
    expect(size(disc(4.2, 0, kit.solar)).x).toBeCloseTo(4.2, 5);
    expect(size(cone(2, 4, 1, 0, kit.foil)).x).toBeCloseTo(4, 5);
  });

  it('Given an off-axis mirror, Then it is its width by its height, facing +Z', () => {
    const { x, y, z } = size(ellipse(1.9, 1.5, kit));
    expect(x).toBeCloseTo(1.9, 5);
    expect(y).toBeCloseTo(1.5, 5);
    expect(z).toBeLessThan(0.1);
  });

  it('Given three wings out flat from a base, Then they reach their length beyond it', () => {
    const made = wings(3, { width: 1, length: 3 }, 1, 0, 0, kit);
    expect(made.children).toHaveLength(3);
    const { z } = size(made);
    expect(z).toBeGreaterThan(4);
  });
});
