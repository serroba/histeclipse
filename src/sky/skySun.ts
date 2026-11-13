/**
 * The Sun in the sky view (#603): its disc, the glare round it, and the corona when the Moon
 * hides the whole bright disc. Its light (where it is, how high, how much of it shows) is shared
 * with the sky's glow, the ground and the Moon, which read it from `light`.
 */

import {
  AdditiveBlending,
  type CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Vector3 as Vec3 } from '../astro/matrix';
import { type ProjectionUniforms, SUN_ANGULAR_RADIUS, SUN_DISTANCE, toScene } from './skyFrame';
import { GLOW_FRAGMENT, GLOW_VERTEX, SUN_FRAGMENT, SUN_VERTEX } from './skyShaders';
import { coronaTexture, glowTexture } from './skyTextures';

/** The Sun's light, as uniforms the sky's other materials read. */
export interface SunLight {
  /** Its direction in the scene. */
  readonly sunDirection: { readonly value: Vector3 };
  /** Its altitude, degrees. */
  readonly sunAltitude: { value: number };
  /** How much of its disc shows: 1, or less while the Moon covers it. */
  readonly sunlight: { value: number };
}

/** Where the Sun is seen at a moment, and how much of it the Moon leaves. */
export interface SunMoment {
  /** Its apparent direction in the horizon frame. */
  readonly seen: Vec3;
  /** Its altitude, degrees. */
  readonly altitude: number;
  readonly share: number;
}

const SUN_RADIUS = SUN_DISTANCE * Math.tan(SUN_ANGULAR_RADIUS);

export class SkySun {
  readonly disc: Mesh;
  readonly glow: Mesh;
  readonly corona: Mesh;
  readonly light: SunLight = {
    sunDirection: { value: new Vector3(0, -1, 0) },
    sunAltitude: { value: -90 },
    sunlight: { value: 1 },
  };
  readonly #glowOpacity = { value: 1 };
  readonly #projection: ProjectionUniforms;
  readonly #fieldOfView: () => number;
  #share = 1;

  /** `fieldOfView` is the view's, in degrees, read each time the glare is shown. */
  constructor(projection: ProjectionUniforms, fieldOfView: () => number) {
    this.#projection = projection;
    this.#fieldOfView = fieldOfView;
    this.disc = new Mesh(
      // Fine enough to stay round when the view closes in on it.
      new SphereGeometry(SUN_RADIUS, 96, 48),
      new ShaderMaterial({
        uniforms: { ...projection, color: { value: new Color(0xfff6e0) } },
        vertexShader: SUN_VERTEX,
        fragmentShader: SUN_FRAGMENT,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.disc.renderOrder = 3;
    this.glow = this.#glowDisc(glowTexture(), (SUN_RADIUS * 14) / SUN_DISTANCE, this.#glowOpacity);
    this.glow.renderOrder = 3;
    // The corona: only seen when the Moon hides the whole bright disc.
    this.corona = this.#glowDisc(coronaTexture(), (SUN_RADIUS * 9) / SUN_DISTANCE, { value: 1 });
    this.corona.renderOrder = 3;
    this.corona.visible = false;
  }

  /** Place the Sun for a moment, and share its light. */
  place({ seen, altitude, share }: SunMoment): void {
    const [x, y, z] = toScene(seen);
    this.light.sunDirection.value.set(x, y, z);
    this.light.sunAltitude.value = altitude;
    this.disc.position.set(x, y, z).multiplyScalar(SUN_DISTANCE);
    this.glow.position.copy(this.disc.position);
    this.disc.visible = altitude > -1;
    this.glow.visible = this.disc.visible && share > 0;
    this.#share = share;
    this.showGlow();
    this.light.sunlight.value = share;
    this.corona.position.copy(this.disc.position);
    this.corona.visible = this.disc.visible && share < 0.002;
  }

  /**
   * The glare round the Sun, by how much of it is showing; and faded as the view closes in, as
   * it spans some 4° and would cover a narrow view, hiding the disc it surrounds.
   */
  showGlow(): void {
    const close = Math.min(1, Math.max(0.1, (this.#fieldOfView() - 2) / 10));
    this.#glowOpacity.value = Math.min(1, this.#share * 4) * close;
  }

  #glowDisc(map: CanvasTexture, extent: number, opacity: { value: number }): Mesh {
    return new Mesh(
      new PlaneGeometry(1, 1),
      new ShaderMaterial({
        uniforms: { ...this.#projection, map: { value: map }, extent: { value: extent }, opacity },
        vertexShader: GLOW_VERTEX,
        fragmentShader: GLOW_FRAGMENT,
        blending: AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        side: DoubleSide,
      }),
    );
  }
}
