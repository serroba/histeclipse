import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { awayFromSun } from './craftAttitude';

const axis = (x: number, y: number, z: number): Vector3 => new Vector3(x, y, z);

describe('which way a craft points (#796)', () => {
  const at = axis(0, 0, 235);
  const sun = axis(0, 0, -23_455);

  it('Given Webb, Then its +Y points away from the Sun and its mirror (+Z) toward the north', () => {
    const turn = awayFromSun(at, sun, 'y');
    expect(
      axis(0, 1, 0)
        .applyQuaternion(turn)
        .distanceTo(axis(0, 0, 1)),
    ).toBeLessThan(1e-9);
    expect(
      axis(0, 0, 1)
        .applyQuaternion(turn)
        .distanceTo(axis(0, 1, 0)),
    ).toBeLessThan(1e-9);
  });

  it('Given Hubble, Then its aperture (+Z) points away from the Sun, its +Y toward the north', () => {
    const turn = awayFromSun(axis(1, 0, 0), axis(-100, 0, 0), 'z');
    expect(
      axis(0, 0, 1)
        .applyQuaternion(turn)
        .distanceTo(axis(1, 0, 0)),
    ).toBeLessThan(1e-9);
    expect(
      axis(0, 1, 0)
        .applyQuaternion(turn)
        .distanceTo(axis(0, 1, 0)),
    ).toBeLessThan(1e-9);
  });

  it('Given any place, Then the turn is a rotation, never a mirror', () => {
    for (const [x, y, z] of [
      [3, 4, 5],
      [-200, 1, 0.3],
      [0, 50, 0],
    ] as const) {
      for (const away of ['y', 'z'] as const) {
        const turn = awayFromSun(axis(x, y, z), sun, away);
        expect(new Matrix4().makeRotationFromQuaternion(turn).determinant()).toBeCloseTo(1, 9);
        expect(turn.length()).toBeCloseTo(1, 9);
      }
    }
  });

  it('Given the Sun right below the north, Then a square direction is still found', () => {
    const turn = awayFromSun(axis(0, 10, 0), axis(0, -10, 0), 'y');
    expect(
      axis(0, 1, 0)
        .applyQuaternion(turn)
        .distanceTo(axis(0, 1, 0)),
    ).toBeLessThan(1e-9);
    expect(Number.isFinite(turn.w)).toBe(true);
  });
});
