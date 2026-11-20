import { describe, expect, it } from 'vitest';

import { sunTurn } from './eclipticTurn';
import { apply, type Vector3 } from './matrix';

const OBLIQUITY = (84_381.406 / 3600) * (Math.PI / 180);

/** `r` along the ecliptic at `degrees` of longitude, `above` it, J2000 equatorial. */
function onEcliptic(degrees: number, r = 1, above = 0): Vector3 {
  const l = (degrees * Math.PI) / 180;
  const [x, y, z] = [r * Math.cos(l), r * Math.sin(l), above];
  return [
    x,
    y * Math.cos(OBLIQUITY) - z * Math.sin(OBLIQUITY),
    y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY),
  ];
}

function expectNear(a: Vector3, b: Vector3): void {
  expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeLessThan(1e-9);
}

describe('the turn that follows the Sun along the ecliptic (#998)', () => {
  it('Given the Sun moved 40°, Then it carries the Sun there, and anything with it', () => {
    const turn = sunTurn(onEcliptic(100, 1.5e8), onEcliptic(140, 1.47e8));
    expectNear(apply(turn, onEcliptic(100)), onEcliptic(140));
    expectNear(apply(turn, onEcliptic(280, 2, 0.3)), onEcliptic(320, 2, 0.3));
  });

  it('Given the Sun where it was, Then nothing turns', () => {
    const sun = onEcliptic(10, 1.5e8);
    expectNear(apply(sunTurn(sun, sun), [1, 2, 3]), [1, 2, 3]);
  });

  it('Then it is a rotation: lengths kept', () => {
    const turned = apply(sunTurn(onEcliptic(0), onEcliptic(250)), [3, -4, 12]);
    expect(Math.hypot(...turned)).toBeCloseTo(13, 9);
  });
});
