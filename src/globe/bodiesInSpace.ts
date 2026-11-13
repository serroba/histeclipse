/**
 * Where everything beyond Earth is (#603): the Sun and its J2000 frame, the orbit loops, the
 * Moon, the planets and their moons, placed in the globe's Earth-fixed scene for each moment.
 * Also how each body's surface turns into the scene's axes, for the camera, and how Earth turned
 * between moments, so a far camera can stay still among the stars.
 *
 * The meshes are made and added to the scene by the globe, in its order; this places them.
 */

import { type IUniform, Matrix4, type Mesh, type Object3D, Quaternion, Vector3 } from 'three';
import { apply, type Matrix3, multiply, transpose } from '../astro/matrix';
import { PLANETS, type PlanetName } from '../astro/planets';
import type { Body } from '../state/viewState';
import type { LayerHost } from './layerHost';
import type { MoonMeshes } from './moonMeshes';
import { isMoonBody } from './moonLook';
import type { PlanetMeshes } from './planetMeshes';
import { MOON_RADIUS_EARTH_RADII, sceneFromKm, sceneRotation } from './spaceFrame';
import type { SunMeshes } from './sunMeshes';
import type { SpaceBodies } from './surfaces';

/** What is placed, and what is told where. */
export interface SpaceWorld {
  readonly sunMeshes: SunMeshes;
  readonly moon: Mesh;
  readonly planets: PlanetMeshes;
  readonly moonSystems: MoonMeshes;
  /** The orbit loops, which ride with the Sun in its frame. */
  readonly orbits: Object3D;
  /** Every body's mesh, for where it is. */
  readonly meshes: Readonly<Record<Body, Mesh>>;
  /** Shared with the Earth's and the Moon's shaders: where the Sun and the Moon are. */
  readonly sunPosition: Vector3;
  readonly moonPosition: Vector3;
  /** The Earth's shader's uniforms: the Moon's radius is given once the Moon is placed. */
  readonly earthUniforms: Record<string, IUniform>;
  /** Where `planets` and `space` are written, for the tests. */
  readonly dataset: DOMStringMap;
}

export class BodiesInSpace {
  /** The Sun's frame is J2000, so a camera orbiting the Sun does not spin with Earth. */
  readonly sunFrame = new Quaternion();
  readonly #world: SpaceWorld;
  /** The Moon's map has longitude 0 at the mesh's +Z; geoToVector puts it at +X. */
  readonly #moonMapTurn = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -Math.PI / 2);
  #earthFixedToJ2000: Matrix3 | null = null;

  constructor(world: SpaceWorld) {
    this.#world = world;
  }

  /**
   * How Earth turned since the last moment, in the scene's axes (old Earth-fixed → J2000 → new
   * Earth-fixed), or null before the first: what a far camera is carried along by.
   */
  turnSince(next: Matrix3): Matrix3 | null {
    const last = this.#earthFixedToJ2000;
    return last === null ? null : sceneRotation(multiply(transpose(next), last));
  }

  /** Place the Sun, the orbits, the Moon, the planets and their moons for a moment. */
  place(bodies: SpaceBodies): void {
    const { sunMeshes, moon, planets, moonSystems, orbits, meshes, dataset } = this.#world;
    const sun = sunMeshes.sun;
    const sunFrame = this.sunFrame;
    this.#earthFixedToJ2000 = bodies.earthFixedToJ2000;
    const toEarthFixed = transpose(bodies.earthFixedToJ2000);
    const [r0, r1, r2] = sceneRotation(toEarthFixed);
    sunFrame.setFromRotationMatrix(new Matrix4().set(...r0, 0, ...r1, 0, ...r2, 0, 0, 0, 0, 1));
    sunMeshes.place(new Vector3(...sceneFromKm(apply(toEarthFixed, bodies.sunKm))), sunFrame);
    this.#world.sunPosition.copy(sun.position);
    orbits.position.copy(sun.position);
    orbits.quaternion.copy(sunFrame);
    if (bodies.moonKm === null) {
      moon.visible = false;
    } else {
      moon.position.set(...sceneFromKm(apply(toEarthFixed, bodies.moonKm)));
      moon.lookAt(0, 0, 0);
      moon.visible = true;
      this.#world.moonPosition.copy(moon.position);
      this.#world.earthUniforms['moonRadius'] = { value: MOON_RADIUS_EARTH_RADII };
    }
    const planetsKm = bodies.planetsKm;
    planets.place(
      planetsKm === null
        ? null
        : (Object.fromEntries(
            PLANETS.map((planet) => [
              planet,
              new Vector3(...sceneFromKm(apply(toEarthFixed, planetsKm[planet]))),
            ]),
          ) as Record<PlanetName, Vector3>),
      sun.position,
      sunFrame,
      planetsKm === null ? undefined : { jdTT: bodies.jdTT, km: planetsKm },
    );
    moonSystems.place(
      bodies.jdTT,
      planetsKm === null
        ? null
        : {
            mars: meshes.mars.position,
            jupiter: meshes.jupiter.position,
            saturn: meshes.saturn.position,
          },
      sun.position,
      sunFrame,
    );
    dataset['planets'] = planetsKm === null ? 'off' : 'on';
    dataset['space'] = moon.visible ? 'moon' : 'sun';
  }

  /** Where a body is, and how its surface coordinates turn into the scene's axes. */
  frame(body: Body): { position: Vector3; rotation: Quaternion } {
    const { moon, meshes, sunMeshes } = this.#world;
    if (body === 'moon') {
      return {
        position: moon.position,
        rotation: moon.quaternion.clone().multiply(this.#moonMapTurn),
      };
    }
    if (body === 'sun') return { position: sunMeshes.sun.position, rotation: this.sunFrame };
    // Planets, like the Sun, are orbited in J2000 axes, so the camera does not spin with Earth.
    // The planets' moons ride with their planet: where they are in the scene is their world's.
    if (isMoonBody(body)) {
      return { position: meshes[body].getWorldPosition(new Vector3()), rotation: this.sunFrame };
    }
    if (body !== 'earth') return { position: meshes[body].position, rotation: this.sunFrame };
    return { position: new Vector3(), rotation: new Quaternion() };
  }

  /** From geocentric J2000 km to the scene, at the moment shown; null before the first. */
  spaceToScene(): ReturnType<LayerHost['spaceToScene']> {
    if (this.#earthFixedToJ2000 === null) return null;
    const toScene = transpose(this.#earthFixedToJ2000);
    return (km) => sceneFromKm(apply(toScene, [km[0], km[1], km[2]]));
  }
}
