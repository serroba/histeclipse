/**
 * Moving things over the globe (#602): a curved path between two points, and the directions
 * that stand at a place. The globe's animations and the story scenes share them.
 */

import { Vector3 } from 'three';
import type { GeoPoint } from '../state/viewState';
import { geoToVector } from './geo';

/** A point on the quadratic curve from `a` through control `c` to `b`; `a` is left as it is. */
export function curve(a: Vector3, c: Vector3, b: Vector3, t: number): Vector3 {
  const u = 1 - t;
  return a
    .clone()
    .multiplyScalar(u * u)
    .addScaledVector(c, 2 * u * t)
    .addScaledVector(b, t * t);
}

/** Up, east and north at a place on the unit globe; at a pole, east is taken along +X. */
export function localFrame(place: GeoPoint): { up: Vector3; east: Vector3; north: Vector3 } {
  const up = new Vector3(...geoToVector(place)).normalize();
  const east = new Vector3().crossVectors(new Vector3(0, 1, 0), up);
  if (east.lengthSq() < 1e-9) east.set(1, 0, 0);
  east.normalize();
  const north = new Vector3().crossVectors(up, east).normalize();
  return { up, east, north };
}
