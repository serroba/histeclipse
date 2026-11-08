/**
 * A photon's way out of the Sun, as the 3D story draws it (#317): a random walk from the core
 * out through the radiative zone, where light is absorbed and given off again countless times;
 * then convection carries the energy up the last third; at the surface it leaves as visible
 * light. Each drawn step stands for a vast number of real ones (a step is about a centimetre),
 * and the walk keeps to the quarter the cut opens, so it stays in view.
 *
 * Distances are in the Sun's radius. Values are those sourced on #277: about 170,000 years
 * through the radiative zone (Mitalas & Sills 1992), X-rays of about 1 keV at the core and
 * visible light of about 2.5 eV at the surface.
 */

export type Point = readonly [x: number, y: number, z: number];

/** Where the radiative zone ends and the convective zone begins, in the Sun's radius. */
export const RADIATIVE_EDGE = 0.7;

/** Years for light's energy to cross the radiative zone (Mitalas & Sills 1992). */
export const ESCAPE_YEARS = 170_000;

export interface PhotonWalk {
  readonly points: readonly Point[];
  /** The first point carried by convection rather than walked. */
  readonly convectionFrom: number;
}

/** What the light is, along its way out. */
export type Band = 'gamma' | 'xray' | 'convection' | 'visible';

export interface BandInfo {
  readonly band: Band;
  /** As the label beside the photon says it. */
  readonly label: string;
  /** As the list beside the scene explains it. */
  readonly about: string;
}

export const BANDS: readonly BandInfo[] = [
  {
    band: 'gamma',
    label: 'γ ray, 0.511 MeV',
    about: 'born a gamma ray, from a positron meeting an electron',
  },
  {
    band: 'xray',
    label: 'X-rays, about 1 keV',
    about:
      'at once absorbed and given off again as X-rays, about 1 keV at the core: a random walk, about 170,000 years across the radiative zone (Mitalas & Sills 1992; quick estimates give ten times less)',
  },
  {
    band: 'convection',
    label: 'carried up by convection',
    about: 'past the radiative zone, hot plasma rising carries the energy up the last third',
  },
  {
    band: 'visible',
    label: 'visible light, about 2.5 eV',
    about: 'at the surface, 5,772 K, it leaves as sunlight, softened to visible light',
  },
];

/** A seeded random number from 0 to 1, the same walk every time. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

/** Into the open quarter of the cut: x ≤ 0 and z ≥ 0, mirrored back where a step left it. */
function intoOpenQuarter([x, y, z]: Point): Point {
  return [-Math.abs(x), y, Math.abs(z)];
}

const length = ([x, y, z]: Point): number => Math.hypot(x, y, z);

/** Which way the walk drifts out: mostly up, across the cut faces, so it is seen climbing. */
const UPWARD: Point = [-0.3, 0.9, 0.3];

/**
 * The walk from `start`, `step` long a step, a little biased (`drift`) toward `toward` so that
 * it gets out in a few hundred steps, then a rising plume to the surface.
 */
export function photonWalk(
  start: Point,
  step = 0.006,
  drift = 0.12,
  seed = 7,
  toward: Point = UPWARD,
): PhotonWalk {
  const bias = length(toward);
  const [tx, ty, tz] = [toward[0] / bias, toward[1] / bias, toward[2] / bias];
  const random = seeded(seed);
  const points: Point[] = [start];
  let at = start;
  while (length(at) < RADIATIVE_EDGE && points.length < 5000) {
    // A direction at random, uniformly over the sphere.
    const z = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const [ax, ay, az] = at;
    at = intoOpenQuarter([
      ax + step * (ring * Math.cos(angle) + drift * tx),
      ay + step * (ring * Math.sin(angle) + drift * ty),
      az + step * (z + drift * tz),
    ]);
    points.push(at);
  }
  const convectionFrom = points.length;
  // Up a plume from where the walk left off, outward, swaying a little, to the surface.
  const [ex, ey, ez] = at;
  const r = length(at);
  const out: Point = [ex / r, ey / r, ez / r];
  const rises = 40;
  for (let i = 1; i <= rises; i += 1) {
    const reach = r + ((1 - r) * i) / rises;
    const sway = 0.02 * Math.sin((i / rises) * Math.PI * 3);
    points.push(
      intoOpenQuarter([out[0] * reach + sway, out[1] * reach, out[2] * reach - sway * 0.5]),
    );
  }
  return { points, convectionFrom };
}

/** What the light is at point `index` of `walk`. */
export function bandAt(walk: PhotonWalk, index: number): Band {
  if (index >= walk.points.length - 1) return 'visible';
  if (index >= walk.convectionFrom) return 'convection';
  // Its first few steps: the gamma ray, before the core's heat turns it to X-rays.
  return index < 6 ? 'gamma' : 'xray';
}

/** Years gone by at point `index`, the walk's share of the 170,000; none more in the plume. */
export function yearsAt(walk: PhotonWalk, index: number): number {
  const walked = Math.min(index, walk.convectionFrom - 1) / Math.max(1, walk.convectionFrom - 1);
  return Math.round(ESCAPE_YEARS * walked);
}
