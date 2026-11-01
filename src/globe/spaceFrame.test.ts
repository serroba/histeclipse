import { describe, expect, it } from 'vitest';

import { apply, rotationZ, type Vector3 } from '../astro/matrix';
import { geoToVector } from './geo';
import {
  hiddenBehind,
  apparentRadiusPixels,
  attachedPose,
  blendPose,
  fromScene,
  mergeMarkers,
  MOON_RADIUS_EARTH_RADII,
  sceneFromKm,
  sceneRotation,
  toScene,
} from './spaceFrame';

describe('scene axes', () => {
  it('map the pole to +Y and 90° east to −Z, like the globe', () => {
    // Earth-fixed (x, y, z): the North Pole and 90° E.
    for (const [equatorial, place] of [
      [[0, 0, 1], { latitude: 90, longitude: 0 }],
      [[0, 1, 0], { latitude: 0, longitude: 90 }],
    ] as const) {
      const expected = geoToVector(place);
      toScene(equatorial).forEach((value, axis) => {
        expect(value).toBeCloseTo(expected[axis] ?? Number.NaN, 12);
      });
    }
  });

  it('round-trip', () => {
    expect(fromScene(toScene([1, 2, 3]))).toEqual([1, 2, 3]);
  });

  it('carry rotations into scene axes consistently', () => {
    const rotation = rotationZ(0.7);
    const v: Vector3 = [0.3, -0.5, 0.8];
    const viaEquatorial = toScene(apply(rotation, v));
    const viaScene = apply(sceneRotation(rotation), toScene(v));
    viaScene.forEach((value, axis) => {
      expect(value).toBeCloseTo(viaEquatorial[axis] ?? Number.NaN, 12);
    });
  });

  it('convert kilometres to Earth radii', () => {
    expect(sceneFromKm([6378.137, 0, 0])).toEqual([1, 0, -0]);
  });
});

describe('apparentRadiusPixels', () => {
  const view = { verticalFovDegrees: 40, viewportHeight: 900 };

  it('fills about half the height for a body seen from 1/tan(20°) radii away', () => {
    const distance = 1 / Math.tan((20 * Math.PI) / 180);
    expect(apparentRadiusPixels({ ...view, radius: 1, distance })).toBeCloseTo(450, 9);
  });

  it('is far below a pixel for Earth seen from beyond the Sun', () => {
    expect(apparentRadiusPixels({ ...view, radius: 1, distance: 50_000 })).toBeLessThan(0.03);
  });
});

describe('mergeMarkers', () => {
  it('keeps markers that are apart', () => {
    const labels = mergeMarkers(
      [
        { name: 'Earth', x: 0, y: 0 },
        { name: 'Moon', x: 100, y: 0 },
      ],
      40,
    );
    expect([...labels]).toEqual([
      ['Earth', 'Earth'],
      ['Moon', 'Moon'],
    ]);
  });

  it('folds close markers into the first one', () => {
    const labels = mergeMarkers(
      [
        { name: 'Earth', x: 0, y: 0 },
        { name: 'Moon', x: 10, y: 5 },
        { name: 'Sun', x: -3, y: 20 },
      ],
      40,
    );
    expect(labels.get('Earth')).toBe('Earth, Moon and Sun');
    expect(labels.get('Moon')).toBeNull();
    expect(labels.get('Sun')).toBeNull();
  });

  it('names a pair with "and"', () => {
    const labels = mergeMarkers(
      [
        { name: 'Moon', x: 0, y: 0 },
        { name: 'Sun', x: 1, y: 1 },
      ],
      40,
    );
    expect(labels.get('Moon')).toBe('Moon and Sun');
  });

  it('is empty without markers', () => {
    expect(mergeMarkers([], 40).size).toBe(0);
  });
});

describe('attachedPose', () => {
  const moon: Vector3 = [0, 0, 60];

  it('stands on Earth facing the Moon, framing it', () => {
    const pose = attachedPose('moon-from-earth', moon);
    expect(pose.eye).toEqual([0, 0, 1.05]);
    expect(pose.target).toEqual(moon);
    // The Moon spans about 0.53° from 59 Earth radii, so 40% of the view is about 1.3°.
    expect(pose.fovDegrees).toBeCloseTo(1.32, 2);
  });

  it('stands on the Moon facing Earth, framing it', () => {
    const pose = attachedPose('earth-from-moon', moon);
    expect(pose.eye[2]).toBeCloseTo(60 - 1.05 * MOON_RADIUS_EARTH_RADII, 12);
    expect(pose.target).toEqual([0, 0, 0]);
    // Earth spans 1.92° from the Moon, 3.6 times the Moon’s 0.53° seen from Earth.
    expect(pose.fovDegrees).toBeCloseTo(4.8, 2);
  });
});

describe('blendPose', () => {
  const from = { eye: [4, 0, 0] as Vector3, target: [0, 0, 0] as Vector3, fovDegrees: 40 };
  const to = { eye: [0, 0, 64] as Vector3, target: [0, 0, 60] as Vector3, fovDegrees: 2.5 };

  it('starts and ends at the poses', () => {
    expect(blendPose(from, to, 0)).toEqual(from);
    const end = blendPose(from, to, 1);
    end.eye.forEach((value, axis) => {
      expect(value).toBeCloseTo(to.eye[axis] ?? Number.NaN, 9);
    });
    expect(end.fovDegrees).toBeCloseTo(2.5, 9);
  });

  it('halfway, is at the geometric mean distance and lens, a quarter turn halved', () => {
    const mid = blendPose(from, to, 0.5);
    expect(Math.hypot(...mid.eye)).toBeCloseTo(16, 9);
    expect(mid.fovDegrees).toBeCloseTo(10, 9);
    expect(Math.atan2(mid.eye[2], mid.eye[0])).toBeCloseTo(Math.PI / 4, 9);
    expect(mid.target).toEqual([0, 0, 30]);
  });

  it('copes with eyes in the same direction', () => {
    const near = { ...from, eye: [2, 0, 0] as Vector3 };
    expect(blendPose(near, from, 0.5).eye[0]).toBeCloseTo(Math.SQRT2 * 2, 9);
  });
});

describe('bodies hidden behind others', () => {
  it('are those whose centre a nearer disc covers', () => {
    const hidden = hiddenBehind(
      [
        { name: 'Jupiter', x: 100, y: 100, distance: 50, radius: 200 },
        { name: 'Saturn', x: 150, y: 120, distance: 400_000, radius: 0.5 },
        { name: 'Sun', x: 900, y: 100, distance: 300_000, radius: 4 },
        { name: 'Mars', x: 110, y: 100, distance: 10, radius: 0.1 },
        // Behind the Sun's dot, but the dot is too small to hide anything.
        { name: 'Venus', x: 901, y: 101, distance: 400_000, radius: 0.2 },
      ],
      10,
    );
    expect([...hidden]).toEqual(['Saturn']);
  });
});
