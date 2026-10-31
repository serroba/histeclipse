/**
 * Conversions between geographic coordinates and the globe's 3D frame.
 *
 * The frame matches three.js `SphereGeometry` texture mapping for an equirectangular map
 * centered on Greenwich: +Y is the North Pole, longitude 0° points along +X, and 90° E
 * along −Z. Distances are in Earth radii.
 */

import type { GeoPoint, GlobeCamera } from '../state/viewState';

const RADIANS = Math.PI / 180;

export type Vector3Tuple = readonly [x: number, y: number, z: number];

export function geoToVector({ latitude, longitude }: GeoPoint, radius = 1): Vector3Tuple {
  const lat = latitude * RADIANS;
  const lon = longitude * RADIANS;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}

export function vectorToGeo([x, y, z]: Vector3Tuple): GeoPoint {
  const length = Math.hypot(x, y, z);
  if (length === 0) throw new RangeError('The zero vector has no direction');
  // atan2 rather than asin(y / length): asin loses precision close to the poles.
  const latitude = Math.atan2(y, Math.hypot(x, z)) / RADIANS;
  // At the poles any longitude is correct; report 0 rather than an arbitrary atan2 result.
  const longitude = Math.hypot(x, z) < 1e-12 ? 0 : Math.atan2(-z, x) / RADIANS;
  return { latitude, longitude: longitude === -180 ? 180 : longitude };
}

export function cameraPosition({ target, distance }: GlobeCamera): Vector3Tuple {
  return geoToVector(target, distance);
}

export function cameraFromPosition(position: Vector3Tuple): GlobeCamera {
  return { target: vectorToGeo(position), distance: Math.hypot(...position) };
}
