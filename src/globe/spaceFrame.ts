/**
 * The space view's frame. The scene is Earth-fixed and in Earth radii, with the axes mapped to
 * three.js as the globe maps them (`geo.ts`): x stays, the pole (z) becomes +Y, and y becomes
 * −Z. The Moon and Sun are carried in from J2000 by Earth's rotation at each moment.
 */

import { multiply, transpose, type Matrix3, type Vector3 } from '../astro/matrix';
import type { Viewpoint } from '../state/viewState';

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

/** A body on screen: where, how far from the camera, and its radius in pixels. */
export interface ScreenDisc {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly distance: number;
  readonly radius: number;
}

/**
 * Names of bodies hidden behind another: a nearer body whose disc on screen, at least
 * `minRadius` pixels across, covers their centre. From Jupiter, Saturn can sit right behind
 * it; its marker should not float on top. A dot-sized disc hides nothing, so a far-off body
 * lined up behind it stays findable.
 */
export function hiddenBehind(discs: readonly ScreenDisc[], minRadius: number): ReadonlySet<string> {
  const hidden = new Set<string>();
  for (const far of discs) {
    const covered = discs.some(
      (near) =>
        near !== far &&
        near.radius >= minRadius &&
        near.distance < far.distance &&
        Math.hypot(near.x - far.x, near.y - far.y) < near.radius,
    );
    if (covered) hidden.add(far.name);
  }
  return hidden;
}

/** Where the camera is, what it looks at, and its field of view on the narrower side. */
export interface CameraPose {
  readonly eye: Vector3;
  readonly target: Vector3;
  readonly fovDegrees: number;
}

/** Share of the view's narrower side the looked-at body fills in an attached viewpoint. */
const FRAMED_SHARE = 0.4;
/**
 * How far out from the surface the camera stands, in body radii: just outside Earth's drawn
 * atmosphere. Next to the 60 Earth radii to the Moon, the offset does not change what is seen.
 */
const STANDING_HEIGHT = 1.05;

/**
 * The camera for a viewpoint attached to the bodies, given the Moon's scene position (Earth
 * radii, Earth at the origin). Positions are true; only the lens narrows, like binoculars.
 */
export function attachedPose(viewpoint: Exclude<Viewpoint, 'free'>, moon: Vector3): CameraPose {
  const distance = Math.hypot(...moon);
  const toMoon = moon.map((value) => value / distance) as unknown as Vector3;
  if (viewpoint === 'moon-from-earth') {
    const eye = scale(toMoon, STANDING_HEIGHT);
    return {
      eye,
      target: moon,
      fovDegrees: framingFov(MOON_RADIUS_EARTH_RADII, distance - STANDING_HEIGHT),
    };
  }
  const height = MOON_RADIUS_EARTH_RADII * STANDING_HEIGHT;
  return {
    eye: scale(toMoon, distance - height),
    target: [0, 0, 0],
    fovDegrees: framingFov(1, distance - height),
  };
}

function framingFov(radius: number, distance: number): number {
  return (2 * Math.asin(radius / distance) * 180) / Math.PI / FRAMED_SHARE;
}

function scale([x, y, z]: Vector3, factor: number): Vector3 {
  return [x * factor, y * factor, z * factor];
}

/**
 * A step `t` (0 to 1) along a flight between poses. The eye swings around Earth's centre with
 * its distance changing geometrically, so a flight from the ground to the Moon spends as long
 * on the first Earth radius as on the last fifty. The lens changes geometrically too.
 */
export function blendPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const fromRadius = Math.hypot(...from.eye);
  const toRadius = Math.hypot(...to.eye);
  const radius = fromRadius * (toRadius / fromRadius) ** t;
  const direction = slerp(scale(from.eye, 1 / fromRadius), scale(to.eye, 1 / toRadius), t);
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  return {
    eye: scale(direction, radius),
    target: [
      lerp(from.target[0], to.target[0]),
      lerp(from.target[1], to.target[1]),
      lerp(from.target[2], to.target[2]),
    ],
    fovDegrees: from.fovDegrees * (to.fovDegrees / from.fovDegrees) ** t,
  };
}

/** Spherical interpolation between unit vectors; falls back to a straight blend when parallel. */
function slerp(a: Vector3, b: Vector3, t: number): Vector3 {
  const cosine = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(cosine);
  const sine = Math.sin(angle);
  const [wa, wb] =
    sine < 1e-6 ? [1 - t, t] : [Math.sin((1 - t) * angle) / sine, Math.sin(t * angle) / sine];
  return [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2]];
}
