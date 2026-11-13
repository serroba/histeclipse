/**
 * Earth itself (#603): the globe with its shader, built once from the uniforms every part shares
 * and the features' own parts (#379), and the atmosphere's glow around it. Until the map arrives
 * it wears the open ocean's plain colour.
 */

import {
  AdditiveBlending,
  BackSide,
  DataTexture,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  type Vector3,
  Vector4,
} from 'three';
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX } from './bodyShaders';
import {
  type AssembledParts,
  assembleEarthParts,
  checkSamplers,
  type EarthPart,
} from './earthParts';
import { EARTH_VERTEX, earthFragment } from './earthShader';
import { surfaceUniforms } from './earthSurfaces';
import { SUN_RADIUS_EARTH_RADII } from './spaceFrame';
import { temperatureUniforms } from './temperatureShader';

/** Stand-ins until the maps arrive: the Blue Marble's open ocean and the Moon's mean grey. */
const OCEAN_RGB = [11, 28, 66] as const;
export const MOON_RGB = [128, 126, 122] as const;

/** A one-pixel texture of one colour (sRGB bytes). */
export function plainTexture([red, green, blue]: readonly [number, number, number]): DataTexture {
  const texture = new DataTexture(new Uint8Array([red, green, blue, 255]), 1, 1);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** What lights Earth, shared with the Moon's shader and set with the bodies each moment. */
export interface EarthLight {
  readonly sunDirection: Vector3;
  /** 1 in deep time: the globe lit evenly, with no day and night. */
  readonly evenLight: { value: number };
  readonly moonPosition: Vector3;
  readonly sunPosition: Vector3;
}

export interface EarthMeshes {
  readonly earth: Mesh<SphereGeometry, ShaderMaterial>;
  readonly atmosphere: Mesh;
  /** The plain map Earth wears until its own arrives. */
  readonly plainMap: DataTexture;
  /** The features' parts as built in, with each one's uniforms. */
  readonly parts: AssembledParts;
}

/** Make Earth and its atmosphere; `overlay` is the map painted over its surface. */
export function createEarthMeshes(
  light: EarthLight,
  overlay: Texture,
  earthParts: readonly EarthPart[],
): EarthMeshes {
  const plainMap = plainTexture(OCEAN_RGB);
  const { sunDirection, evenLight, moonPosition, sunPosition } = light;
  const uniforms = {
    dayMap: { value: plainMap },
    dayRect: { value: new Vector4(0, 0, 1, 1) },
    dayAlpha: { value: 1 },
    ...surfaceUniforms(),
    ...temperatureUniforms(),
    evenLight,
    overlayMap: { value: overlay },
    empiresActive: { value: 0 },
    iceOutlinesActive: { value: 0 },
    sunDirection: { value: sunDirection },
    moonPosition: { value: moonPosition },
    moonRadius: { value: 0 },
    sunPosition: { value: sunPosition },
    sunRadius: { value: SUN_RADIUS_EARTH_RADII },
  };
  // The features' parts of the shader (#379), built in once: the shader is not made again.
  const parts = assembleEarthParts(earthParts, new Set(Object.keys(uniforms)));
  const shader = earthFragment(parts);
  checkSamplers(shader);
  const earth = new Mesh(
    new SphereGeometry(1, 128, 64),
    new ShaderMaterial({
      uniforms: { ...uniforms, ...parts.uniforms },
      vertexShader: EARTH_VERTEX,
      fragmentShader: shader,
    }),
  );
  const atmosphere = new Mesh(
    new SphereGeometry(1.04, 96, 48),
    new ShaderMaterial({
      uniforms: { sunDirection: { value: sunDirection }, evenLight },
      vertexShader: ATMOSPHERE_VERTEX,
      fragmentShader: ATMOSPHERE_FRAGMENT,
      side: BackSide,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  return { earth, atmosphere, plainMap, parts };
}
