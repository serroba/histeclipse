/**
 * Particles carried by a field of currents (#927), worked out apart from the page: each at a
 * longitude and latitude, moved each frame by the current where it is (read between the grid's
 * nodes), and started again at a random place at sea when it grows old or leaves the currents.
 * Their pace is shown in degrees a second at the field's bound, the same on the screen for the
 * slow deep currents as for the fast surface ones; the panel says so. Below the bound the pace
 * goes as the square root of the speed, so slow water still visibly flows, as Windy draws calm air.
 */

import type { Field } from '../../data/oceanCurrents';

/** Degrees a particle moves in a second at the field's bound. */
export const PACE = 14;
/** Seconds a particle lives before it starts again, at most. */
const LIFE = 6;

/** A typed array's value at `index`: the arrays here are made full length, so never empty. */
export function valueAt(array: Float32Array, index: number): number {
  return array[index] ?? 0;
}

export interface Particles {
  readonly longitude: Float32Array;
  readonly latitude: Float32Array;
  readonly age: Float32Array;
  /** Where each was before the last step, to draw its streak from. */
  readonly fromLongitude: Float32Array;
  readonly fromLatitude: Float32Array;
  /** Its speed at the last step, as a share of the bound. */
  readonly speed: Float32Array;
}

/** The current at a place, m/s, between the nodes; null where none. */
export function sample(
  field: Field,
  longitude: number,
  latitude: number,
): { readonly u: number; readonly v: number } | null {
  const x = ((((longitude + 180) % 360) + 360) % 360) * ((field.width - 1) / 360);
  const y = (90 - latitude) * ((field.height - 1) / 180);
  const x0 = Math.floor(x);
  const y0 = Math.max(0, Math.min(field.height - 2, Math.floor(y)));
  const fx = x - x0;
  const fy = y - y0;
  const at = (column: number, row: number): number =>
    row * field.width + Math.min(field.width - 1, column);
  const corners: readonly (readonly [number, number])[] = [
    [at(x0, y0), (1 - fx) * (1 - fy)],
    [at(x0 + 1, y0), fx * (1 - fy)],
    [at(x0, y0 + 1), (1 - fx) * fy],
    [at(x0 + 1, y0 + 1), fx * fy],
  ];
  let u = 0;
  let v = 0;
  for (const [index, weight] of corners) {
    const east = valueAt(field.u, index);
    const north = valueAt(field.v, index);
    if (Number.isNaN(east) || Number.isNaN(north)) return null;
    u += east * weight;
    v += north * weight;
  }
  return { u, v };
}

/** `count` particles, nowhere yet: each starts at sea on the first step. */
export function particles(count: number): Particles {
  const age = new Float32Array(count).fill(LIFE);
  return {
    longitude: new Float32Array(count),
    latitude: new Float32Array(count),
    age,
    fromLongitude: new Float32Array(count),
    fromLatitude: new Float32Array(count),
    speed: new Float32Array(count),
  };
}

/** Start a particle again at a random place where there is a current (a few tries). */
function respawn(field: Field, flock: Particles, index: number, random: () => number): void {
  for (let tries = 0; tries < 20; tries += 1) {
    const longitude = random() * 360 - 180;
    // Even over the sphere's area, not crowded at the poles.
    const latitude = (Math.asin(random() * 2 - 1) * 180) / Math.PI;
    if (sample(field, longitude, latitude) !== null) {
      flock.longitude[index] = longitude;
      flock.latitude[index] = latitude;
      flock.fromLongitude[index] = longitude;
      flock.fromLatitude[index] = latitude;
      flock.age[index] = random() * LIFE;
      flock.speed[index] = 0;
      return;
    }
  }
  flock.age[index] = LIFE;
}

/** Move every particle `seconds` along the field. */
export function step(
  field: Field,
  flock: Particles,
  seconds: number,
  random: () => number = Math.random,
): void {
  const pace = PACE * seconds;
  for (let index = 0; index < flock.age.length; index += 1) {
    const age = valueAt(flock.age, index) + seconds;
    flock.age[index] = age;
    const longitude = valueAt(flock.longitude, index);
    const latitude = valueAt(flock.latitude, index);
    const here = age >= LIFE ? null : sample(field, longitude, latitude);
    if (here === null) {
      respawn(field, flock, index, random);
      continue;
    }
    const shrink = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
    const share = Math.min(1, Math.hypot(here.u, here.v) / field.bound);
    // Along the current, at the square root of its share of the bound: degrees per m/s.
    const along = share === 0 ? 0 : (pace * Math.sqrt(share)) / (share * field.bound);
    flock.fromLongitude[index] = longitude;
    flock.fromLatitude[index] = latitude;
    let next = longitude + (here.u * along) / shrink;
    if (next > 180) next -= 360;
    if (next < -180) next += 360;
    flock.longitude[index] = next;
    flock.latitude[index] = Math.max(-89.9, Math.min(89.9, latitude + here.v * along));
    flock.speed[index] = share;
  }
}
