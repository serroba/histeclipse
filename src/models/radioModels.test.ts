import { Box3, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';

import {
  buildAlma,
  buildArecibo,
  buildFast,
  buildLovell,
  buildParkes,
  buildSkaLow,
  buildSkaMid,
  buildVla,
  yPads,
} from './radioModels';

const box = (object: Object3D): Box3 => {
  object.updateMatrixWorld(true);
  return new Box3().setFromObject(object);
};

/** The groups of copies in a model (`array`), by how many each holds. */
const counts = (model: Object3D): number[] => {
  const found: number[] = [];
  model.traverse((part) => {
    if (part.name === 'array') found.push(part.children.length);
  });
  return found;
};

describe('the radio telescopes as 3D models (#859)', () => {
  it('Given Lovell, Then it stands on its 107.5 m rail, some 89 m tall at 50° elevation', () => {
    const { min, max } = box(buildLovell());
    expect(min.y).toBeCloseTo(-0.2, 1);
    // Below its 89.0 m, which it reaches facing the horizon (`kit.test.ts`).
    expect(max.y).toBeGreaterThan(70);
    expect(max.y).toBeLessThan(89);
  });

  it('Given Parkes, Then its 64 m dish is centred 27.4 m up', () => {
    const { max } = box(buildParkes());
    expect(max.y).toBeGreaterThan(27.4 + 20);
    expect(max.y).toBeLessThan(27.4 + 0.41 * 64 + 5);
  });

  it('Given Arecibo, Then its bowl is 305 m across and 51 m deep, its platform 137 m above the rim', () => {
    const model = buildArecibo();
    const { min, max } = box(model);
    expect(min.y).toBeCloseTo(-51, 5);
    expect(max.y).toBeCloseTo(140, 0);
    expect(box(model.children.at(0) ?? model).getSize(new Vector3()).x).toBeCloseTo(305, 1);
  });

  it('Given FAST, Then its bowl is 500 m across, curved to a 315 m radius, its cabin about 140 m above its floor', () => {
    const model = buildFast();
    const bowl = box(model.children.at(0) ?? model);
    expect(bowl.getSize(new Vector3()).x).toBeCloseTo(500, 0);
    const depth = 315 - Math.sqrt(315 ** 2 - 250 ** 2);
    expect(bowl.min.y).toBeCloseTo(-depth, 3);
    const cabin = model.children.at(2) ?? model;
    expect(cabin.position.y + depth).toBeCloseTo(140, 5);
  });

  it('Given the VLA, Then 27 dishes of 25 m stand on a Y, nine to an arm', () => {
    expect(counts(buildVla())).toEqual([27]);
    const pads = yPads(9, 600);
    expect(pads).toHaveLength(27);
    const reach = Math.max(...pads.map(([east, north]) => Math.hypot(east, north)));
    expect(reach).toBeCloseTo(600, 5);
  });

  it('Given ALMA, Then 54 antennas of 12 m and 12 of 7 m, 66 in all', () => {
    expect(counts(buildAlma())).toEqual([54, 12]);
  });

  it('Given SKA-Mid, Then seven dishes; SKA-Low, one station of 256 antennas 2 m tall', () => {
    expect(counts(buildSkaMid())).toEqual([7]);
    const low = buildSkaLow();
    expect(counts(low)).toEqual([256]);
    expect(box(low).max.y).toBeCloseTo(2, 5);
  });
});
