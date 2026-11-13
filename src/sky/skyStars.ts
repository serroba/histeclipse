/**
 * The stars in the sky view (#603): one point each, coloured by temperature and sized by
 * magnitude, where they were at the moment shown after their proper motion. The planets are
 * drawn by the same shader with these uniforms, and the figures' lines follow these positions.
 */

import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial } from 'three';
import type { Matrix3, Vector3 as Vec3 } from '../astro/matrix';
import { starDirection } from '../astro/stars';
import type { Sky } from '../data/sky';
import type { JulianDay } from '../time/julianDay';
import { aberrate, apparentDirection, apparentMagnitude } from './horizon';
import { type ProjectionUniforms, STAR_RADIUS, toScene } from './skyFrame';
import { STAR_FRAGMENT, STAR_VERTEX } from './skyShaders';
import { starColor } from './starColor';

/** The proper-motion positions only need recomputing after this many days. */
const MOTION_STEP_DAYS = 365.25;

/** Where the stars are at a moment, and how faint a star can be and still be seen. */
export interface StarsMoment {
  readonly jdTT: JulianDay;
  readonly horizon: Matrix3;
  /** Earth's velocity, for annual aberration. */
  readonly motion: Vec3;
  readonly limit: number;
}

export class SkyStars {
  readonly points: Points;
  /** The stars' positions in the scene, three numbers each. */
  readonly positions: Float32Array;
  /** What the stars' shader reads: the projection's, the faintest seen, and the zoom. */
  readonly uniforms;
  readonly #catalogue: Sky['stars'];
  readonly #count: number;
  readonly #positionAttribute: BufferAttribute;
  /** J2000 directions after proper motion, recomputed when time has moved far enough. */
  readonly #j2000: Float64Array;
  #epoch: number | null = null;

  constructor(world: {
    readonly stars: Sky['stars'];
    readonly projection: ProjectionUniforms;
    readonly pixelRatio: number;
  }) {
    const catalogue = world.stars;
    const count = catalogue.hr.length;
    this.#catalogue = catalogue;
    this.#count = count;
    this.#j2000 = new Float64Array(count * 3);
    // Positions change with time; magnitudes and colours are fixed.
    this.positions = new Float32Array(count * 3);
    const colours = new Float32Array(count * 3);
    const magnitudes = new Float32Array(count);
    catalogue.vmag.forEach((vmag, index) => {
      magnitudes[index] = vmag;
      const [r, g, b] = starColor(catalogue.bv[index] ?? null);
      colours.set([r, g, b], index * 3);
    });
    const geometry = new BufferGeometry();
    this.#positionAttribute = new BufferAttribute(this.positions, 3);
    geometry.setAttribute('position', this.#positionAttribute);
    geometry.setAttribute('color', new BufferAttribute(colours, 3));
    geometry.setAttribute('magnitude', new BufferAttribute(magnitudes, 1));
    this.uniforms = {
      ...world.projection,
      limit: { value: 6.5 },
      pixelRatio: { value: world.pixelRatio },
      zoom: { value: 1 },
    };
    this.points = new Points(
      geometry,
      new ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: STAR_VERTEX,
        fragmentShader: STAR_FRAGMENT,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 1;
  }

  /** Stars grow a little as the view closes in, up to twice their size. */
  setFieldOfView(fov: number): void {
    this.uniforms.zoom.value = Math.min(2, Math.max(1, Math.sqrt(60 / fov)));
  }

  /** Place the stars for a moment; returns how many are above the horizon and bright enough. */
  place({ jdTT, horizon, motion, limit }: StarsMoment): number {
    this.#move(jdTT);
    const j2000 = this.#j2000;
    const positions = this.positions;
    let seen = 0;
    for (let index = 0; index < this.#count; index++) {
      const direction = apparentDirection(
        horizon,
        aberrate(
          [j2000[index * 3] ?? 0, j2000[index * 3 + 1] ?? 0, j2000[index * 3 + 2] ?? 0],
          motion,
        ),
      );
      const [x, y, z] = toScene(direction);
      positions[index * 3] = x * STAR_RADIUS;
      positions[index * 3 + 1] = y * STAR_RADIUS;
      positions[index * 3 + 2] = z * STAR_RADIUS;
      const altitude = (Math.asin(Math.max(-1, Math.min(1, direction[2]))) * 180) / Math.PI;
      if (altitude > 0 && apparentMagnitude(this.#catalogue.vmag[index] ?? 99, altitude) < limit)
        seen++;
    }
    this.#positionAttribute.needsUpdate = true;
    this.uniforms.limit.value = limit;
    return seen;
  }

  /** The stars' J2000 directions at `jdTT`, after their proper motion. */
  #move(jdTT: JulianDay): void {
    if (this.#epoch !== null && Math.abs(jdTT - this.#epoch) < MOTION_STEP_DAYS) return;
    this.#epoch = jdTT;
    const { ra, dec, pmRa, pmDec, parallax, radialVelocity } = this.#catalogue;
    for (let index = 0; index < this.#count; index++) {
      const direction = starDirection(
        {
          ra: ra[index] ?? 0,
          dec: dec[index] ?? 0,
          pmRa: pmRa[index] ?? 0,
          pmDec: pmDec[index] ?? 0,
          parallax: parallax[index] ?? null,
          radialVelocity: radialVelocity[index] ?? null,
        },
        jdTT,
      );
      this.#j2000.set(direction, index * 3);
    }
  }
}
