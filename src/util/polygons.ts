/** Whether points lie inside rings of [longitude, latitude] in degrees. */

import { elementAt } from './arrays';

export type Ring = readonly (readonly [number, number])[];

/** Whether a point lies inside an odd number of the rings (holes count out), by ray casting. */
export function insideRings(rings: readonly Ring[], longitude: number, latitude: number): boolean {
  let crossings = 0;
  for (const ring of rings) {
    for (let at = 0, before = ring.length - 1; at < ring.length; before = at, at += 1) {
      const [x1, y1] = elementAt(ring, at);
      const [x2, y2] = elementAt(ring, before);
      if (
        y1 > latitude !== y2 > latitude &&
        longitude < ((x2 - x1) * (latitude - y1)) / (y2 - y1) + x1
      ) {
        crossings += 1;
      }
    }
  }
  return crossings % 2 === 1;
}

/** The same, for rings whose longitudes may run past ±180° (made continuous across it). */
export function insideWrapped(
  rings: readonly Ring[],
  longitude: number,
  latitude: number,
): boolean {
  return [0, 360, -360].some((offset) => insideRings(rings, longitude + offset, latitude));
}

/** Flat [lon, lat, lon, lat, …] × scale as rings of points in degrees. */
export function ringsOf(flat: readonly (readonly number[])[], scale: number): Ring[] {
  return flat.map((ring) => {
    const points: [number, number][] = [];
    for (let at = 0; at + 1 < ring.length; at += 2) {
      points.push([elementAt(ring, at) / scale, elementAt(ring, at + 1) / scale]);
    }
    return points;
  });
}
