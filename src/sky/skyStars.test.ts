import { describe, expect, it } from 'vitest';
import { IDENTITY, type Vector3 as Vec3 } from '../astro/matrix';
import type { Sky } from '../data/sky';
import type { JulianDay } from '../time/julianDay';
import { projectionUniforms } from '../test/fakes';
import { SkyStars } from './skyStars';

const J2000 = 2_451_545 as JulianDay;
const STILL: Vec3 = [0, 0, 0];

/** Polaris-like, overhead with the identity turn; one on the equator; one bright and fast. */
const CATALOGUE: Sky['stars'] = {
  hr: [1, 2, 3],
  ra: [0, 90, 0],
  dec: [89.99, 0, -60],
  pmRa: [0, 0, 0],
  pmDec: [0, 0, 100_000],
  parallax: [null, 10, null],
  radialVelocity: [null, null, 5],
  vmag: [2, 3, 0],
  bv: [0.6, null, 1.5],
};

function stars() {
  return new SkyStars({
    stars: CATALOGUE,
    projection: projectionUniforms(),
    pixelRatio: 2,
  });
}

describe('SkyStars', () => {
  it('draws one coloured point per star, behind everything else', () => {
    const made = stars();
    expect(made.points.geometry.getAttribute('position').count).toBe(3);
    expect(made.points.geometry.getAttribute('magnitude').array[2]).toBe(0);
    expect(made.uniforms.pixelRatio.value).toBe(2);
    expect(made.points.renderOrder).toBe(1);
  });

  it('places the stars on their sphere, and counts those above the horizon and bright enough', () => {
    const made = stars();
    const seen = made.place({ jdTT: J2000, horizon: IDENTITY, motion: STILL, limit: 6 });
    // Overhead: the scene's +y. The star on the equator sits on the horizon; the third is below.
    expect(made.positions[1]).toBeCloseTo(100, 1);
    expect(seen).toBe(1);
    expect(made.uniforms.limit.value).toBe(6);
    expect(made.place({ jdTT: J2000, horizon: IDENTITY, motion: STILL, limit: 1 })).toBe(0);
  });

  it('moves the stars by their proper motion, only once a year has gone by', () => {
    const made = stars();
    made.place({ jdTT: J2000, horizon: IDENTITY, motion: STILL, limit: 6 });
    const before = made.positions[7];
    made.place({ jdTT: (J2000 + 100) as JulianDay, horizon: IDENTITY, motion: STILL, limit: 6 });
    expect(made.positions[7]).toBe(before);
    made.place({ jdTT: (J2000 + 36_525) as JulianDay, horizon: IDENTITY, motion: STILL, limit: 6 });
    expect(made.positions[7]).not.toBe(before);
  });

  it('treats a star missing from a column as at the origin, faint and without colour', () => {
    const made = new SkyStars({
      stars: {
        ...CATALOGUE,
        hr: [1, 2],
        ra: [0],
        dec: [0],
        pmRa: [],
        pmDec: [],
        parallax: [],
        radialVelocity: [],
        vmag: [1],
        bv: [],
      },
      projection: projectionUniforms(),
      pixelRatio: 1,
    });
    // The second star falls back to RA 0, Dec 0, magnitude 99: on the horizon, never counted.
    expect(made.place({ jdTT: J2000, horizon: IDENTITY, motion: STILL, limit: 6 })).toBe(0);
    expect(made.positions[3]).toBeCloseTo(100);
  });

  it('grows the stars as the view closes in, up to twice their size', () => {
    const made = stars();
    made.setFieldOfView(90);
    expect(made.uniforms.zoom.value).toBe(1);
    made.setFieldOfView(15);
    expect(made.uniforms.zoom.value).toBe(2);
  });
});
