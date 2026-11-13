/**
 * What the sky's parts share (#603): its axes, how far out each thing is drawn, and the
 * projection's uniforms, which every material in the sky reads so one update moves them all.
 */

import type { Vector2 } from 'three';
import { EARTH_SHADOW_ENLARGEMENT } from '../astro/occultation';
import type { Vector3 as Vec3 } from '../astro/matrix';
import { EARTH_RADIUS_KM } from './bodies';
import { lookDirection } from './look';

/** The stars' sphere; only directions matter, so these are the scene's own units. */
export const STAR_RADIUS = 100;
export const SUN_DISTANCE = 80;
/** The Moon sits in front of the Sun, so it is drawn nearer; only its angular size matters. */
export const MOON_DISTANCE = 70;
export const EARTH_SHADOW_RADIUS_KM = EARTH_RADIUS_KM * EARTH_SHADOW_ENLARGEMENT;
export const SUN_ANGULAR_RADIUS = (0.2666 * Math.PI) / 180;

/** The projection's uniforms (see projection.ts), shared by every material in the sky. */
export interface ProjectionUniforms {
  readonly skyScale: { readonly value: Vector2 };
  readonly skyShift: { readonly value: Vector2 };
  readonly skyClip: { readonly value: number };
  readonly skyViewport: { readonly value: Vector2 };
}

/** From the horizon frame (x east, y north, z up) to scene axes (x east, y up, z south). */
export function toScene([east, north, up]: Vec3): [number, number, number] {
  return [east, up, -north];
}

/** The direction at an azimuth and altitude, in the horizon frame. */
export function lookDirectionAt(azimuth: number, altitude: number): Vec3 {
  return lookDirection({ azimuth, altitude, fov: 60 });
}

export function unit(vector: Vec3): Vec3 {
  const length = Math.hypot(...vector);
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
