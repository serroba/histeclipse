/**
 * Which body a tap on the sky picks (#603): the nearest whose reach the tap is within, reach
 * measured as a share of each body's own, so a large disc and a point compete fairly. A pure
 * function of where the bodies are on screen.
 */

import { horizontal } from './horizon';

/** The bodies a tap can pick out of the sky. */
export type SkyBody = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

/** A body tapped, where it stands, and how large it looks (radius, degrees; 0 for a point). */
export interface SkyTap {
  readonly body: SkyBody;
  readonly azimuth: number;
  readonly altitude: number;
  readonly radius: number;
}

/** A body that could be tapped: where it is on screen, and in the scene. */
export interface TapTarget {
  readonly body: SkyBody;
  /** Its centre on screen, pixels from the canvas's corner. */
  readonly x: number;
  readonly y: number;
  /** Its radius on the sky, degrees; 0 for a point. */
  readonly radius: number;
  /** Its position in the scene's axes (x east, y up, z south). */
  readonly scene: { readonly x: number; readonly y: number; readonly z: number };
}

/** A tap this near a body picks it, pixels from its centre (or its disc's edge): a fingertip. */
const BODY_TAP_PIXELS = 24;

/**
 * The body a tap at (`x`, `y`) on the canvas picks, or null for the sky itself.
 * `perDegree` is how many pixels a degree of sky spans now.
 */
export function pickBody(
  targets: readonly TapTarget[],
  x: number,
  y: number,
  perDegree: number,
): SkyTap | null {
  let best: { tapped: SkyTap; share: number } | null = null;
  for (const { body, x: at, y: down, radius, scene } of targets) {
    const reach = Math.max(BODY_TAP_PIXELS, radius * perDegree + BODY_TAP_PIXELS / 3);
    const share = Math.hypot(x - at, y - down) / reach;
    if (share >= 1 || (best !== null && share >= best.share)) continue;
    // Scene axes back to the horizon's: east, north, up.
    const { azimuth, altitude } = horizontal([scene.x, -scene.z, scene.y]);
    best = { tapped: { body, azimuth, altitude, radius }, share };
  }
  return best?.tapped ?? null;
}
