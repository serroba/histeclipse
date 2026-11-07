/**
 * The sky view's stereographic projection, the same maths as the GLSL in `SKY_PROJECTION`.
 *
 * A rectilinear (pinhole) camera stretches things near the edge of a wide view by 1/cos²θ in
 * one direction only, so on a tall phone the Sun near the top or bottom becomes a long oval.
 * The stereographic projection is conformal: small things keep their shape everywhere, only
 * growing by 1/cos²(θ/2) away from the centre (about 1.33× at 60°, 2× at 90°). It is
 * Stellarium's default for the same reason.
 *
 * Directions are in view space: the camera looks down −z, x to the right, y up. A direction
 * at angle θ from the centre lands at radius tan(θ/2) on the projection plane; the plane is
 * scaled so the narrower side's edge sits at half the field of view, then shifted to centre
 * the view between the panels. Results are normalised device coordinates (NDC, −1 to 1).
 */

import type { Vector3 } from '../astro/matrix';

/** Directions farther than this from the centre are clipped: nothing on screen is near it. */
export const CLIP_ANGLE_DEGREES = 150;
export const CLIP_COS = Math.cos((CLIP_ANGLE_DEGREES * Math.PI) / 180);

/** How a stereographic view maps onto the screen. */
export interface ProjectionFrame {
  /** NDC per unit of the projection plane, across and up. */
  readonly scaleX: number;
  readonly scaleY: number;
  /** NDC shift upward of the view's centre (negative moves it down). */
  readonly shiftY: number;
}

/** The most sky a tall view may span top to bottom, degrees: more bends it like a fisheye. */
export const LONGEST_SPAN = 110;

/**
 * The widest field (across the narrower side, degrees) a `width` by `height` view may show. A
 * tall view, a phone held upright, spans no more than `LONGEST_SPAN` top to bottom, so the
 * horizon does not bend into an arc; a wide one is not limited, and looks as it always has.
 */
export function widestFov(width: number, height: number): number {
  if (width >= height) return Number.POSITIVE_INFINITY;
  const long = Math.max(height, 1);
  const short = Math.max(width, 1);
  // Stereographic: a point θ from the centre lies tan(θ/2)/tan(fov/4) narrow half-widths out.
  const quarter = Math.atan((Math.tan((LONGEST_SPAN * Math.PI) / 180 / 4) * short) / long);
  return (quarter * 4 * 180) / Math.PI;
}

/**
 * The frame for a field of view `fov` (degrees, across the narrower side) on a view `width`
 * by `height` pixels, centred in the space left between panels covering `insetTop` and
 * `insetBottom` pixels.
 */
export function projectionFrame(
  fov: number,
  width: number,
  height: number,
  insetTop = 0,
  insetBottom = 0,
): ProjectionFrame {
  const w = Math.max(width, 1);
  const h = Math.max(height, 1);
  const scale = 1 / Math.tan((fov * Math.PI) / 180 / 4);
  return {
    scaleX: w >= h ? (scale * h) / w : scale,
    scaleY: w >= h ? scale : (scale * w) / h,
    shiftY: -(insetTop - insetBottom) / h,
  };
}

/** A view-space direction (any length) to NDC; null when it is clipped (behind the viewer). */
export function project(
  frame: ProjectionFrame,
  [x, y, z]: Vector3,
): readonly [number, number] | null {
  const length = Math.hypot(x, y, z);
  if (length === 0) return null;
  const dz = z / length;
  if (-dz < CLIP_COS) return null;
  const denominator = 1 - dz;
  return [
    (x / length / denominator) * frame.scaleX,
    (y / length / denominator) * frame.scaleY + frame.shiftY,
  ];
}

/** NDC back to the unit view-space direction that lands there. */
export function unproject(frame: ProjectionFrame, ndcX: number, ndcY: number): Vector3 {
  const px = ndcX / frame.scaleX;
  const py = (ndcY - frame.shiftY) / frame.scaleY;
  const r2 = px * px + py * py;
  return [(2 * px) / (1 + r2), (2 * py) / (1 + r2), (r2 - 1) / (1 + r2)];
}

/** How much bigger than at the centre things look at `angle` radians from it: 1/cos²(θ/2). */
export function magnification(angle: number): number {
  const c = Math.cos(angle / 2);
  return 1 / (c * c);
}

/** Pixels per degree of sky at the centre of a view `width` pixels wide. */
export function pixelsPerDegree(frame: ProjectionFrame, width: number): number {
  // NDC per radian at the centre is scale/2 (radius tan(θ/2)); NDC spans width/2 pixels.
  return ((frame.scaleX / 2) * (width / 2) * Math.PI) / 180;
}

/** NDC to pixels from the top left of a view `width` by `height`. */
export function toPixels(
  [x, y]: readonly [number, number],
  width: number,
  height: number,
): readonly [number, number] {
  return [((x + 1) / 2) * width, ((1 - y) / 2) * height];
}

/**
 * The GLSL counterpart: `skyProject(view)` for any view-space point, `skyProjectSprite` for a
 * screen-facing square of angular size `extent` (radians) around `centre`, and
 * `skyViewDirection()` for the view-space direction under the current fragment.
 * Uniforms: skyScale (scaleX, scaleY), skyShift (0, shiftY), skyClip (CLIP_COS) and, for
 * fragments, skyViewport (drawing-buffer pixels).
 *
 * The clip coordinate z runs from about cos(clip) at the centre to 1 at the clip angle, so the
 * GPU drops what lies behind the viewer. Depth testing is off for the whole sky (everything
 * sits on spheres drawn back to front), so z is used only for that clipping.
 */
export const SKY_PROJECTION = /* glsl */ `
  uniform vec2 skyScale;
  uniform vec2 skyShift;
  uniform float skyClip;

  vec4 skyProject(vec3 view) {
    vec3 d = normalize(view);
    vec2 p = d.xy / max(1.0 - d.z, 1e-6);
    return vec4(p * skyScale + skyShift, 1.0 + d.z + skyClip, 1.0);
  }

  vec4 skyProjectSprite(vec3 centre, vec2 offset) {
    vec4 projected = skyProject(centre);
    vec3 d = normalize(centre);
    vec2 p = d.xy / max(1.0 - d.z, 1e-6);
    // The local scale of tan(θ/2): (1 + tan²(θ/2)) / 2 per radian, the same both ways.
    projected.xy += offset * 0.5 * (1.0 + dot(p, p)) * skyScale;
    return projected;
  }
`;

export const SKY_UNPROJECTION = /* glsl */ `
  uniform vec2 skyScale;
  uniform vec2 skyShift;
  uniform vec2 skyViewport;

  vec3 skyViewDirection() {
    vec2 ndc = gl_FragCoord.xy / skyViewport * 2.0 - 1.0;
    vec2 p = (ndc - skyShift) / skyScale;
    float r2 = dot(p, p);
    return vec3(2.0 * p, r2 - 1.0) / (1.0 + r2);
  }
`;
