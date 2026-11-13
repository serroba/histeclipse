/**
 * The Moon in the sky view (#603): its disc, as large as it looks from the place, its phase,
 * and Earth's shadow on it in a lunar eclipse. It is placed for each moment shown.
 */

import {
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import { apply, type Matrix3, type Vector3 as Vec3 } from '../astro/matrix';
import {
  angularRadius,
  illuminatedFraction,
  MOON_RADIUS_KM,
  moonSunlight,
  SUN_RADIUS_KM,
} from './bodies';
import { aberrate, apparentDirection, horizontal } from './horizon';
import {
  EARTH_SHADOW_RADIUS_KM,
  MOON_DISTANCE,
  type ProjectionUniforms,
  SUN_ANGULAR_RADIUS,
  toScene,
  unit,
} from './skyFrame';
import { MOON_FRAGMENT, MOON_VERTEX } from './skyShaders';

/** What the Moon needs from the sky around it. */
export interface SkyMoonWorld {
  readonly projection: ProjectionUniforms;
  /** The Sun's direction in the scene, shared with the sky's other materials. */
  readonly sunDirection: { readonly value: Vector3 };
  readonly textureUrl: string;
  /** Where the Moon's altitude, phase and sunlight are written, for the tests. */
  readonly dataset: DOMStringMap;
  invalidate(): void;
}

/** Where the Moon is, and what lights it, at a moment. */
export interface MoonMoment {
  readonly horizon: Matrix3;
  readonly sunJ2000: Vec3;
  readonly moonJ2000: Vec3 | null;
  /** The Sun and the Moon from the place, in km. */
  readonly sunHere: Vec3;
  readonly moonHere: Vec3 | null;
  /** The Sun's altitude, degrees: the Moon's earthshine fades as the sky brightens. */
  readonly sunHigh: number;
  /** Earth's velocity, for annual aberration. */
  readonly motion: Vec3;
}

export class SkyMoon {
  readonly mesh: Mesh;
  readonly #texture;
  readonly #uniforms;
  readonly #dataset: DOMStringMap;

  constructor(world: SkyMoonWorld) {
    this.#dataset = world.dataset;
    this.#texture = new TextureLoader().load(world.textureUrl, () => {
      world.invalidate();
    });
    this.#texture.colorSpace = SRGBColorSpace;
    this.#uniforms = {
      ...world.projection,
      map: { value: this.#texture },
      sunDirection: world.sunDirection,
      moonCentre: { value: new Vector3() },
      moonKm: { value: new Vector3() },
      kmPerUnit: { value: 1 },
      antiSun: { value: new Vector3() },
      umbraSlope: { value: 0 },
      penumbraSlope: { value: 0 },
      earthRadius: { value: EARTH_SHADOW_RADIUS_KM },
      sunAngularRadius: { value: SUN_ANGULAR_RADIUS },
      night: { value: 1 },
    };
    // As on the globe: turn the map's longitude 0 (at +X) to +Z, which lookAt() aims at us.
    const geometry = new SphereGeometry(1, 96, 48);
    geometry.rotateY(-Math.PI / 2);
    this.mesh = new Mesh(
      geometry,
      new ShaderMaterial({
        uniforms: this.#uniforms,
        vertexShader: MOON_VERTEX,
        fragmentShader: MOON_FRAGMENT,
        depthTest: false,
        depthWrite: false,
        // Drawn after the Sun and its glow, which it covers in an eclipse.
        transparent: true,
      }),
    );
    this.mesh.renderOrder = 3.5;
    this.mesh.visible = false;
  }

  /** How far the Moon's disc reaches from its centre, in degrees on the sky. */
  get angularRadius(): number {
    return (Math.atan(this.mesh.scale.x / MOON_DISTANCE) * 180) / Math.PI;
  }

  /** Place the Moon for a moment, or hide it when there is none or it is below the horizon. */
  place(moment: MoonMoment): void {
    const { horizon, sunJ2000, moonJ2000, sunHere, moonHere, sunHigh, motion } = moment;
    const moon = this.mesh;
    if (moonJ2000 === null || moonHere === null) {
      moon.visible = false;
      return;
    }
    const seen = apparentDirection(horizon, aberrate(moonHere, motion));
    const high = horizontal(seen).altitude;
    moon.visible = high > -1;
    const [mx, my, mz] = toScene(seen);
    const radius = MOON_DISTANCE * Math.tan(angularRadius(MOON_RADIUS_KM, moonHere));
    moon.position.set(mx, my, mz).multiplyScalar(MOON_DISTANCE);
    moon.scale.setScalar(radius);
    // The near side faces us (the map's longitude 0 is the mesh's +Z), north toward the pole.
    moon.up.set(...toScene(apply(horizon, [0, 0, 1])));
    moon.lookAt(0, 0, 0);

    // Earth's shadow, in the scene's axes but in km: the horizon frame is a turn of J2000.
    const inScene = (vector: Vec3): Vector3 => new Vector3(...toScene(apply(horizon, vector)));
    const sunDistance = Math.hypot(...sunJ2000);
    const uniforms = this.#uniforms;
    uniforms.moonCentre.value.copy(moon.position);
    uniforms.moonKm.value.copy(inScene(moonJ2000));
    uniforms.kmPerUnit.value = MOON_RADIUS_KM / radius;
    uniforms.antiSun.value.copy(inScene(unit(sunJ2000))).negate();
    uniforms.umbraSlope.value = (SUN_RADIUS_KM - EARTH_SHADOW_RADIUS_KM) / sunDistance;
    uniforms.penumbraSlope.value = (SUN_RADIUS_KM + EARTH_SHADOW_RADIUS_KM) / sunDistance;
    uniforms.night.value = 1 - Math.min(1, Math.max(0, (sunHigh + 12) / 12));

    this.#dataset['moonAltitude'] = high.toFixed(2);
    this.#dataset['moonPhase'] = illuminatedFraction(moonHere, sunHere).toFixed(3);
    this.#dataset['moonSunlight'] = moonSunlight(moonJ2000, sunJ2000).toFixed(3);
  }
}
