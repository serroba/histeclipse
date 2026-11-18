import { Mesh, type Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import {
  armLengths,
  bearingDirection,
  createDetectorRig,
  DETECTOR_SITES,
  outputBrightness,
} from './detectorRig';

describe('LIGO Livingston, as drawn (#831)', () => {
  it('points a bearing over the ground, north up −z and east along +x', () => {
    const [eastX, eastZ] = bearingDirection(90);
    expect(eastX).toBeCloseTo(1, 12);
    expect(eastZ).toBeCloseTo(0, 12);
    const [northX, northZ] = bearingDirection(0);
    expect(northX).toBeCloseTo(0, 12);
    expect(northZ).toBeCloseTo(-1, 12);
  });

  it('has its arms at right angles, on their true bearings', () => {
    for (const site of Object.values(DETECTOR_SITES)) {
      expect(Math.abs(site.x - site.y)).toBe(90);
    }
    expect(DETECTOR_SITES.L1.latitude).toBeCloseTo(30.56, 2);
  });

  it('stretches one arm as it shrinks the other, their difference the strain', () => {
    const { x, y } = armLengths(0.3);
    expect(x - y).toBeCloseTo(0.3, 12);
    expect(x + y).toBeCloseTo(2, 12);
  });

  it('keeps the output dark with the arms equal, and lights it as they differ', () => {
    expect(outputBrightness(0, 0.4)).toBe(0);
    expect(outputBrightness(0.4, 0.4)).toBeCloseTo(1, 12);
    expect(outputBrightness(-0.2, 0.4)).toBeCloseTo(0.5, 12);
    expect(outputBrightness(9, 0.4)).toBe(1);
    expect(outputBrightness(0.1, 0)).toBe(0);
  });

  it('moves its end mirrors out and in along the bearings', () => {
    const rig = createDetectorRig(DETECTOR_SITES.L1);
    const mirrors = (): Vector3[] =>
      rig.group.children
        .filter((child): child is Mesh => child instanceof Mesh)
        .map((mesh) => mesh.position.clone())
        .filter((position) => position.length() > 0.7);
    expect(mirrors().map((at) => at.length())).toEqual([
      expect.closeTo(1, 6),
      expect.closeTo(1, 6),
    ]);
    rig.set(0.4, 0.4);
    expect(mirrors().map((at) => at.length())).toEqual([
      expect.closeTo(1.2, 6),
      expect.closeTo(0.8, 6),
    ]);
    const [eastward, northward] = bearingDirection(DETECTOR_SITES.L1.x);
    const [first] = mirrors();
    expect(first?.x).toBeCloseTo(eastward * 1.2, 6);
    expect(first?.z).toBeCloseTo(northward * 1.2, 6);
    expect(rig.brightness()).toBeCloseTo(1, 12);
    rig.dispose();
  });
});
