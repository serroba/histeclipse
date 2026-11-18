/**
 * A model in metres drawn over the scene (#796, #864): the scene is in Earth radii, where a depth
 * buffer cannot hold apart parts centimetres apart seen from metres away, so a craft or a
 * telescope close up has a scene of its own in metres about it, seen by a camera matched to the
 * view's each frame and drawn over it (`LayerHost.drawOver`).
 */

import type { PerspectiveCamera, Vector3 } from 'three';

import { EARTH_RADIUS_KM } from './spaceFrame';

/** Metres in the scene's unit, an Earth radius. */
export const METRES_PER_SCENE = EARTH_RADIUS_KM * 1000;

/**
 * `seen`, as the view's camera `view` sees it, for a model in metres about a craft at `at`
 * (scene units): the same lens and the same turn, placed relative to the craft in metres.
 */
export function cameraOnCraft(view: PerspectiveCamera, at: Vector3, seen: PerspectiveCamera): void {
  seen.copy(view);
  seen.position.copy(view.position).sub(at).multiplyScalar(METRES_PER_SCENE);
  const distance = seen.position.length();
  seen.near = Math.max(0.01, distance / 100);
  seen.far = distance * 100 + 1000;
  seen.updateProjectionMatrix();
  seen.updateMatrixWorld(true);
}
