import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { bodyAxes } from './planetLook';
import { facing } from './planetMeshes';
import { toScene } from './spaceFrame';

describe('facing', () => {
  it('turns the mesh so its +X is the prime meridian, +Y the pole and −Z 90° east', () => {
    const jd = 2_461_051;
    const km = 3.6e8;
    const turn = facing('mars', jd, km);
    const { pole, prime, east } = bodyAxes('mars', jd, km);
    const expectAlong = (local: Vector3, j2000: readonly [number, number, number]) => {
      const turned = local.applyQuaternion(turn);
      const want = new Vector3(...toScene(j2000));
      expect(turned.distanceTo(want)).toBeLessThan(1e-9);
    };
    expectAlong(new Vector3(1, 0, 0), prime);
    expectAlong(new Vector3(0, 1, 0), pole);
    expectAlong(new Vector3(0, 0, -1), east);
  });
});
