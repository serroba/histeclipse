import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Vector3 } from '../astro/matrix';
import {
  CLIP_ANGLE_DEGREES,
  CLIP_COS,
  magnification,
  pixelsPerDegree,
  project,
  projectionFrame,
  toPixels,
  unproject,
} from './projection';

const RAD = Math.PI / 180;

/** The view-space direction `angle` degrees from the centre, turned `bearing` from +x. */
function off(angle: number, bearing = 0): Vector3 {
  const a = angle * RAD;
  const b = bearing * RAD;
  return [Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), -Math.cos(a)];
}

function at(frame: ReturnType<typeof projectionFrame>, direction: Vector3): [number, number] {
  const ndc = project(frame, direction);
  if (ndc === null) throw new Error('clipped');
  return [ndc[0], ndc[1]];
}

describe('projectionFrame', () => {
  it('puts the field of view across the narrower side, square pixels both ways', () => {
    const tall = projectionFrame(90, 400, 900);
    expect(tall.scaleY / tall.scaleX).toBeCloseTo(400 / 900, 12);
    const wide = projectionFrame(90, 1600, 900);
    expect(wide.scaleX / wide.scaleY).toBeCloseTo(900 / 1600, 12);
    expect(wide.shiftY).toBe(-0);
  });

  it('centres the view between panels: a taller top panel moves it down', () => {
    expect(projectionFrame(90, 400, 1000, 300, 100).shiftY).toBeCloseTo(-0.2, 12);
    expect(projectionFrame(90, 0, 0).scaleX).toBeGreaterThan(0);
  });
});

describe('project', () => {
  it('maps the centre to 0 and the narrow edge to ±1 at half the field of view', () => {
    for (const [width, height] of [
      [400, 900],
      [1600, 900],
    ] as const) {
      const frame = projectionFrame(90, width, height);
      expect(at(frame, [0, 0, -5])).toEqual([0, 0]);
      const narrowIsX = width < height;
      const edge = at(frame, off(45, narrowIsX ? 0 : 90));
      expect(edge[narrowIsX ? 0 : 1]).toBeCloseTo(1, 12);
      const other = at(frame, off(45, narrowIsX ? 180 : 270));
      expect(other[narrowIsX ? 0 : 1]).toBeCloseTo(-1, 12);
    }
  });

  it('applies the shift and clips what is behind the viewer', () => {
    const frame = projectionFrame(60, 800, 800, 200, 0);
    expect(at(frame, [0, 0, -1])[1]).toBeCloseTo(-0.25, 12);
    expect(project(frame, [0, 0, 1])).toBeNull();
    expect(project(frame, [0, 0, 0])).toBeNull();
    expect(project(frame, off(CLIP_ANGLE_DEGREES + 1))).toBeNull();
    expect(project(frame, off(CLIP_ANGLE_DEGREES - 1))).not.toBeNull();
    expect(CLIP_COS).toBeCloseTo(-Math.sqrt(3) / 2, 12);
  });

  it('keeps a small disc round near the edge of a tall view', () => {
    const [width, height] = [412, 839];
    const frame = projectionFrame(120, width, height);
    // A disc of the Sun's size 55° above the centre, sampled around its rim.
    const centre = off(55, 90);
    const radius = 0.27 * RAD;
    const up: Vector3 = [0, Math.cos(55 * RAD), Math.sin(55 * RAD)];
    const side: Vector3 = [1, 0, 0];
    const rim = Array.from({ length: 72 }, (_, i) => {
      const t = (i / 72) * 2 * Math.PI;
      const [u, v] = [Math.cos(t) * Math.tan(radius), Math.sin(t) * Math.tan(radius)];
      const direction: Vector3 = [
        centre[0] + u * side[0] + v * up[0],
        centre[1] + u * side[1] + v * up[1],
        centre[2] + u * side[2] + v * up[2],
      ];
      return toPixels(at(frame, direction), width, height);
    });
    const xs = rim.map(([x]) => x);
    const ys = rim.map(([, y]) => y);
    const across = Math.max(...xs) - Math.min(...xs);
    const tall = Math.max(...ys) - Math.min(...ys);
    expect(tall / across).toBeCloseTo(1, 3);
    // And it is magnified by 1/cos²(θ/2) against the centre, the same both ways.
    const centrePixels = pixelsPerDegree(frame, width) * 0.54;
    expect(across / centrePixels).toBeCloseTo(magnification(55 * RAD), 2);
  });
});

describe('unproject', () => {
  it('turns NDC back into the direction that lands there', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 140, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.double({ min: 5, max: 120, noNaN: true }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 0, max: 300 }),
        (angle, bearing, fov, width, height, inset) => {
          const frame = projectionFrame(fov, width, height, inset, 0);
          const direction = off(angle, bearing);
          const [x, y] = at(frame, direction);
          const back = unproject(frame, x, y);
          back.forEach((value, index) => {
            expect(value).toBeCloseTo(direction[index] ?? NaN, 9);
          });
        },
      ),
    );
  });

  it('gives straight ahead at the shifted centre', () => {
    const frame = projectionFrame(90, 400, 900, 100, 0);
    const [x, y, z] = unproject(frame, 0, frame.shiftY);
    expect([x, y, z]).toEqual([0, 0, -1]);
  });
});

describe('magnification and pixelsPerDegree', () => {
  it('is 1 at the centre and 2 at 90°', () => {
    expect(magnification(0)).toBe(1);
    expect(magnification(Math.PI / 2)).toBeCloseTo(2, 12);
  });

  it('matches a small step from the centre', () => {
    const frame = projectionFrame(90, 1000, 600);
    const step = at(frame, off(0.01))[0];
    const pixels = (step / 2) * 1000;
    expect(pixels / 0.01).toBeCloseTo(pixelsPerDegree(frame, 1000), 4);
  });
});
