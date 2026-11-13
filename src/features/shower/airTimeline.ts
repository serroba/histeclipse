/**
 * The air shower's chapters over time (#317, #604): where each thing is `t` ms into its chapter,
 * worked out apart from the scene. The rays coming in, the shower's front going down and the
 * neutron slowing, the capture's nucleons arriving, trembling and flying off, and the camera's
 * way through each; and the scene's fixed shapes, the stars and the field's lines. Pure and
 * unit-tested; the scene, which places its three.js objects by these, is `airShower.ts`.
 */

import { Vector3 } from 'three';

import { FIRST_COLLISION_KM } from './airCascade';
import { element, makeUp, type Stage } from './neutronCapture';
import { clamp01, ease } from '../../util/timing';

/** The rays' chapter: the two rays come in, and one strikes. */
export const RAYS_MS = 3600;
/** The shower: the proton comes in, then the cascade falls, then the neutron slows. */
const ENTER_MS = 900;
const CASCADE_MS = 3400;
const SLOW_MS = 1000;
export const AIR_MS = ENTER_MS + CASCADE_MS + SLOW_MS;
/** The capture: the neutron arrives, the compound nucleus holds, a proton flies off. */
const ARRIVE_MS = 1800;
const LEAVE_MS = 2500;
const FLY_MS = 1400;
export const CAPTURE_MS = LEAVE_MS + FLY_MS;
/** The camera swings down into the shower's column. */
const SWING_MS = 2200;

/** How long a ray takes to come in, and a strike's flash to fade. */
const RAY_IN_MS = RAYS_MS - 800;
const RAY_FLASH_MS = 700;

/** `count` stars spread evenly over a sphere of `radius`, the same sky every time. */
export function starField(count: number, radius: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const z = 1 - (2 * (i + 0.5)) / count;
    const angle = i * 2.399963;
    const across = Math.sqrt(1 - z * z);
    out.push(across * Math.cos(angle) * radius, z * radius, across * Math.sin(angle) * radius);
  }
  return out;
}

/**
 * A dipole's field line on the shell `shell` (Earth radii at the equator), in the meridian whose
 * equator points `out`: r = shell cos² latitude, from where it leaves the surface to where it
 * comes back.
 */
export function fieldLine(out: Vector3, shell: number, steps = 64): Vector3[] {
  const reach = Math.acos(Math.sqrt(1 / shell));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const latitude = -reach + (2 * reach * i) / steps;
    const r = shell * Math.cos(latitude) ** 2;
    return out
      .clone()
      .multiplyScalar(r * Math.cos(latitude))
      .add(new Vector3(0, r * Math.sin(latitude), 0));
  });
}

/**
 * A ray `t` ms into the chapter, `delay` ms after the first: how far in it is (0 to 1), the
 * point of its track of `points` it has reached, and how far its strike's flash has faded.
 */
export function rayBeat(
  t: number,
  delay: number,
  points: number,
): { readonly progress: number; readonly index: number; readonly bursting: number } {
  const progress = clamp01((t - delay) / RAY_IN_MS);
  return {
    progress,
    index: Math.round(progress * (points - 1)),
    bursting: clamp01((t - delay - RAY_IN_MS) / RAY_FLASH_MS),
  };
}

/**
 * The shower `t` ms into its chapter, the proton coming in from `approach` km above its first
 * collision and the cascade `length` km long: how far in the proton is, the front in km since
 * the first collision (negative before it), how far the front has come down, and how far the
 * neutron has slowed.
 */
export function showerBeat(
  t: number,
  approach: number,
  length: number,
): {
  readonly entering: number;
  readonly front: number;
  readonly descent: number;
  readonly slowing: number;
} {
  const entering = clamp01(t / ENTER_MS);
  const front =
    t < ENTER_MS ? -approach * (1 - entering) : length * clamp01((t - ENTER_MS) / CASCADE_MS);
  return {
    entering,
    front,
    descent: Math.min(FIRST_COLLISION_KM, Math.max(0, front)),
    slowing: clamp01((t - ENTER_MS - CASCADE_MS) / SLOW_MS),
  };
}

/** Whether the first collision's name still shows, the front `front` km on, at `t`. */
export function firstNamed(front: number, t: number): boolean {
  return front >= 0 && t < ENTER_MS + CASCADE_MS * 0.45;
}

/** Whether the particles' names still show, at `t`: until the neutron has begun to slow. */
export function kindsNamed(t: number): boolean {
  return t < ENTER_MS + CASCADE_MS + SLOW_MS * 0.3;
}

/** A collision's flash, `km` after the front passed it: shown while it grows and fades. */
export function flashAt(km: number): {
  readonly visible: boolean;
  readonly scale: number;
  readonly opacity: number;
} {
  const age = km / 2.5;
  return { visible: age >= 0 && age < 1, scale: 0.6 + 2.4 * age, opacity: 1 - age };
}

/**
 * The capture `t` ms into its chapter: the nucleus's stage, how far the neutron has come in and
 * the proton gone out (0 to 1, eased), the burst as the neutron enters, and how far the nucleus
 * has turned from nitrogen's colour to carbon's.
 */
export function captureBeat(t: number): {
  readonly stage: Stage;
  readonly arriving: number;
  readonly flying: number;
  readonly flash: number;
  readonly carbon: number;
} {
  return {
    stage: t < ARRIVE_MS ? 'nitrogen' : t < LEAVE_MS ? 'compound' : 'carbon',
    arriving: ease(clamp01(t / ARRIVE_MS)),
    flying: 1 - (1 - clamp01((t - LEAVE_MS) / FLY_MS)) ** 3,
    flash: clamp01((t - ARRIVE_MS) / 600),
    carbon: clamp01((t - LEAVE_MS) / 600),
  };
}

/** How a nucleon trembles in place at `t`: the more so for an instant once the neutron is in. */
export function tremble(t: number, index: number, stage: Stage): Vector3 {
  const shake = 0.06 + (stage === 'compound' ? 0.18 : 0);
  return new Vector3(
    Math.sin(t / 90 + index * 1.7),
    Math.sin(t / 110 + index * 2.3),
    Math.sin(t / 100 + index * 3.1),
  ).multiplyScalar(shake);
}

/** What the nucleus is called at each stage, with its protons and neutrons. */
export function nucleusWords(stage: Stage): string {
  const { protons, neutrons } = makeUp(stage);
  const name =
    stage === 'compound'
      ? 'nitrogen-15, for an instant'
      : `${element(protons)}-${String(protons + neutrons)}`;
  return `${name}: ${String(protons)} protons, ${String(neutrons)} neutrons`;
}

/**
 * The cameras' ways, `t` ms into each chapter. `fit` widens the shot on a narrow screen (1 at
 * least), `aspect` is the view's width over height.
 * - Rays: round from face on, and closer, Earth radii from the rays' middle.
 * - Shower: from high above the column's edge, down beside it (0 to 1).
 * - Capture: in from far as the neutron comes, then after the proton (each 0 to 1).
 */
export function raysCamera(
  t: number,
  fit: number,
): { readonly turn: number; readonly distance: number } {
  const p = ease(clamp01(t / RAYS_MS));
  return { turn: 0.25 - 0.4 * p, distance: (6.2 - 1.4 * p) * fit ** 1.2 };
}

export function showerCamera(t: number): number {
  return ease(clamp01(t / SWING_MS));
}

export function captureCamera(
  t: number,
  aspect: number,
): { readonly inward: number; readonly after: number } {
  return {
    inward: ease(clamp01(t / ARRIVE_MS)),
    // Less so on a narrow screen, where the nucleus would go off its edge.
    after: ease(clamp01((t - LEAVE_MS) / FLY_MS)) * Math.min(1, aspect),
  };
}
