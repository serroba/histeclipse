/**
 * Where the globe turns when an eclipse is picked (#947): to greatest eclipse, or, once the
 * reader has a place, to that place, which the card's own line is about; halfway between the
 * two when they are near enough to be seen together.
 */

import { geoToVector, vectorToGeo } from '../../globe/geo';
import type { GeoPoint } from '../../state/viewState';

/** Places further apart than this (degrees of arc) can't share the view: the place wins. */
const TOGETHER_DEGREES = 70;

export function eclipseFraming(greatest: GeoPoint, place: GeoPoint | null): GeoPoint {
  if (place === null) return greatest;
  const [ax, ay, az] = geoToVector(greatest);
  const [bx, by, bz] = geoToVector(place);
  const dot = ax * bx + ay * by + az * bz;
  const arc = (Math.acos(Math.min(1, Math.max(-1, dot))) * 180) / Math.PI;
  if (arc > TOGETHER_DEGREES) return place;
  const [x, y, z] = [ax + bx, ay + by, az + bz];
  const length = Math.hypot(x, y, z);
  return vectorToGeo([x / length, y / length, z / length]);
}
