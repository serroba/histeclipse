/**
 * The space view's frame. The scene is inertial: the J2000 equator, in Earth radii, with the
 * axes mapped to three.js the same way the globe maps Earth-fixed coordinates (`geo.ts`):
 * x stays, the pole (z) becomes +Y, and y becomes −Z.
 */

import { multiply, transpose, type Matrix3, type Vector3 } from '../astro/matrix';

export const EARTH_RADIUS_KM = 6378.137;
export const MOON_RADIUS_EARTH_RADII = 1737.4 / EARTH_RADIUS_KM;
export const SUN_RADIUS_EARTH_RADII = 696_000 / EARTH_RADIUS_KM;

/** Equatorial-style (x, y, z with z to the pole) to scene axes. */
export function toScene([x, y, z]: Vector3): Vector3 {
  return [x, z, -y];
}

/** Scene axes back to equatorial-style (x, y, z). */
export function fromScene([x, y, z]: Vector3): Vector3 {
  return [x, -z, y];
}

const SCENE_AXES: Matrix3 = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
];

/** A rotation between equatorial-style frames, expressed in scene axes. */
export function sceneRotation(rotation: Matrix3): Matrix3 {
  return multiply(SCENE_AXES, multiply(rotation, transpose(SCENE_AXES)));
}

/** A geocentric position in km, as scene coordinates in Earth radii. */
export function sceneFromKm(km: Vector3): Vector3 {
  const [x, y, z] = toScene(km);
  return [x / EARTH_RADIUS_KM, y / EARTH_RADIUS_KM, z / EARTH_RADIUS_KM];
}

/**
 * A body's radius on screen, in pixels. Bodies are always drawn at their true size and
 * distance; this only decides when one is too small to see and needs a marker instead.
 */
export function apparentRadiusPixels(options: {
  readonly radius: number;
  readonly distance: number;
  readonly verticalFovDegrees: number;
  readonly viewportHeight: number;
}): number {
  const { radius, distance, verticalFovDegrees, viewportHeight } = options;
  return (
    (radius * viewportHeight) / (2 * distance * Math.tan((verticalFovDegrees * Math.PI) / 360))
  );
}

/** A body's marker on screen, in pixels. */
export interface ScreenMarker {
  readonly name: string;
  readonly x: number;
  readonly y: number;
}

/**
 * The label each marker shows, or null to hide it. Markers within `mergePixels` of an earlier
 * one fold into it, so from far out "Earth and Moon" reads as one point instead of two
 * overlapping names. Earlier markers take precedence.
 */
export function mergeMarkers(
  markers: readonly ScreenMarker[],
  mergePixels: number,
): ReadonlyMap<string, string | null> {
  const groups: { readonly lead: ScreenMarker; readonly names: string[] }[] = [];
  const labels = new Map<string, string | null>();
  for (const marker of markers) {
    const group = groups.find(
      ({ lead }) => Math.hypot(lead.x - marker.x, lead.y - marker.y) < mergePixels,
    );
    if (group === undefined) {
      groups.push({ lead: marker, names: [marker.name] });
    } else {
      group.names.push(marker.name);
      labels.set(marker.name, null);
    }
  }
  for (const { lead, names } of groups) labels.set(lead.name, joinNames(names));
  return labels;
}

function joinNames(names: readonly string[]): string {
  const last = names.at(-1) ?? '';
  return names.length < 2 ? last : `${names.slice(0, -1).join(', ')} and ${last}`;
}
