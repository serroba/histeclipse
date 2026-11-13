/**
 * The Sun (#379): its sphere, which wears SDO's images when they are shown, its glow, and the
 * corona, a plane stood across the line from Earth that shows from Earth's side.
 */

import {
  AdditiveBlending,
  CustomBlending,
  Matrix4,
  Mesh,
  OneFactor,
  PlaneGeometry,
  ShaderMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  ZeroFactor,
  type Camera,
  type Quaternion,
  type Scene,
  type Texture,
} from 'three';

import { SUN_RADIUS_EARTH_RADII, toScene } from './spaceFrame';
import { SOLAR_NORTH_POLE_J2000 } from './sunImage';
import { glowTexture } from './sunGlow';
import { CORONA_FRAGMENT, CORONA_VERTEX, SUN_FRAGMENT, SUN_VERTEX } from './sunShaders';
import type { SunImageTextures } from './surfaces';

export interface SunMeshes {
  readonly sun: Mesh;
  readonly corona: Mesh;
  /** Put the Sun at `position`, its J2000 axes turned by `frame` into the scene's. */
  place(position: Vector3, frame: Quaternion): void;
  /**
   * Close to the Sun its glow would wash out the image; the corona shows from Earth's side.
   * Returns how squarely the camera faces the Sun from Earth's side: 1 as SDO did, −1 from behind.
   */
  shade(camera: Camera): number;
  /** Wear SDO's images, or null for the plain Sun. */
  showImage(image: SunImageTextures | null): void;
}

function sunMesh(uniforms: Record<string, { value: unknown }>): Mesh {
  return new Mesh(
    new SphereGeometry(SUN_RADIUS_EARTH_RADII, 128, 64),
    new ShaderMaterial({ uniforms, vertexShader: SUN_VERTEX, fragmentShader: SUN_FRAGMENT }),
  );
}

function coronaMesh(uniforms: Record<string, { value: unknown }>): Mesh {
  const corona = new Mesh(
    new PlaneGeometry(1, 1),
    new ShaderMaterial({
      uniforms,
      vertexShader: CORONA_VERTEX,
      fragmentShader: CORONA_FRAGMENT,
      // Add light without touching the canvas's alpha, which lets the page's sky show through.
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
      transparent: true,
      depthWrite: false,
    }),
  );
  corona.visible = false;
  return corona;
}

/** Make the Sun, hidden until placed, and add it to `scene`. */
export function createSunMeshes(scene: Scene): SunMeshes {
  const uniforms = {
    // The map of the whole surface, and the newest frame, for the corona.
    surface: { value: null as Texture | null },
    map: { value: null as Texture | null },
    hasMap: { value: 0 },
    toEarth: { value: new Vector3(1, 0, 0) },
    north: { value: new Vector3(0, 1, 0) },
    diskRadius: { value: 0.4 },
    tint: { value: new Vector3(1, 1, 1) },
    // Visible light's limb-darkening coefficient.
    limbDarkening: { value: 0 },
  };
  const sun = sunMesh(uniforms);
  const coronaUniforms = {
    map: uniforms.map,
    diskRadius: uniforms.diskRadius,
    tint: uniforms.tint,
    opacity: { value: 0 },
  };
  const corona = coronaMesh(coronaUniforms);
  scene.add(corona);
  const glow = new Sprite(
    new SpriteMaterial({
      map: glowTexture(),
      blending: AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  glow.scale.setScalar(SUN_RADIUS_EARTH_RADII * 8);
  sun.add(glow);
  sun.visible = false;
  scene.add(sun);

  /** Stand the corona's plane across the line from Earth, north up, sized to the frame. */
  function placeCorona(): void {
    const toEarth = uniforms.toEarth.value;
    const north = uniforms.north.value;
    const up = north.clone().addScaledVector(toEarth, -north.dot(toEarth)).normalize();
    const right = new Vector3().crossVectors(toEarth.clone().negate(), up);
    corona.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(right, up, toEarth));
    corona.position.copy(sun.position);
    // The limb is diskRadius of the frame's width.
    const width = SUN_RADIUS_EARTH_RADII / uniforms.diskRadius.value;
    corona.scale.set(width, width, 1);
  }

  return {
    sun,
    corona,
    place(position, frame) {
      sun.position.copy(position);
      sun.visible = true;
      // The image's frame: toward Earth, and the Sun's rotation axis, in scene axes.
      uniforms.toEarth.value.copy(sun.position).negate().normalize();
      // The frame turns J2000 vectors written in scene axes, like every position here.
      uniforms.north.value.set(...toScene(SOLAR_NORTH_POLE_J2000)).applyQuaternion(frame);
      placeCorona();
    },
    shade(camera) {
      const imaged = uniforms.hasMap.value > 0 && sun.visible;
      const toCamera = camera.position.clone().sub(sun.position);
      const radii = toCamera.length() / SUN_RADIUS_EARTH_RADII;
      glow.material.opacity = imaged ? Math.min(1, Math.max(0, (radii - 12) / 40)) : 1;
      const facing = toCamera.normalize().dot(uniforms.toEarth.value);
      const opacity = imaged ? Math.min(1, Math.max(0, (facing - 0.75) / 0.2)) : 0;
      coronaUniforms.opacity.value = opacity;
      corona.visible = opacity > 0;
      return facing;
    },
    showImage(image) {
      uniforms.hasMap.value = image === null ? 0 : 1;
      if (image === null) return;
      uniforms.surface.value = image.surface;
      uniforms.map.value = image.disc;
      uniforms.tint.value.set(...image.tint);
      uniforms.diskRadius.value = image.diskRadius;
      uniforms.limbDarkening.value = image.limbDarkening;
      placeCorona();
    },
  };
}
