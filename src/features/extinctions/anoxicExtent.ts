/**
 * How much of the seafloor lost its oxygen in each extinction (#1230), as the studies estimate it
 * from uranium isotopes: the share each clock draws, over its time, and the patches that cover
 * that share of today's ocean round a record's place. Where the water lay is not mapped by these
 * studies, so its place is drawn, its area estimated; the words say which.
 *
 * Pure.
 */

import type { GeoPoint } from '../../core/geo';
import { clamp01 } from '../../util/timing';
import { ventsAround } from './fumesModel';

const KYR = 1000 * 365.25 * 86_400;

/** The ocean's share of the Earth's surface today, 361 of 510 million km². */
export const OCEAN_SHARE = 361.1 / 510.1;
/** How many patches the oxygen-poor water is drawn as (the Earth shader's part holds as many). */
export const PATCHES = 9;
/** How far round its place the patches spread at a scale of 1, and each patch's reach, degrees. */
const SPREAD = 22;
const REACHES = [5, 7, 9] as const;

/** A patch of oxygen-poor water: its centre, and how far it reaches, degrees. */
export interface Patch {
  readonly place: GeoPoint;
  readonly reach: number;
}

/** The patches round `place` at `scale`: the farther out, the wider, so they do not look stamped. */
export function patchesAt(place: GeoPoint, scale: number): Patch[] {
  return ventsAround(place, PATCHES, SPREAD * scale).map((centre, index) => ({
    place: centre,
    reach: (REACHES[index % REACHES.length] ?? 5) * scale,
  }));
}

/** A unit vector at `point`. */
function vectorOf({ latitude, longitude }: GeoPoint): readonly [number, number, number] {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

/** Points spread evenly over the sphere (a Fibonacci lattice), to measure areas by. */
const LATTICE = (() => {
  const count = 4000;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, index) => {
    const z = 1 - (2 * (index + 0.5)) / count;
    const r = Math.sqrt(1 - z * z);
    return [r * Math.cos(index * golden), r * Math.sin(index * golden), z] as const;
  });
})();

/**
 * The share of the globe `patches` cover: where the shader shades at least half, within three
 * quarters of a patch's reach.
 */
export function coverOf(patches: readonly Patch[]): number {
  const caps = patches.map(({ place, reach }) => ({
    centre: vectorOf(place),
    cos: Math.cos((0.75 * reach * Math.PI) / 180),
  }));
  const inside = LATTICE.filter(([x, y, z]) =>
    caps.some(({ centre: [a, b, c], cos }) => x * a + y * b + z * c >= cos),
  ).length;
  return inside / LATTICE.length;
}

const scales = new Map<string, number>();

/** The scale at which the patches round `place` cover `share` of the seafloor, as today's: 0 for none. */
export function scaleFor(place: GeoPoint, share: number): number {
  // To the nearest half percent: a share changing as the clock plays is worked out once a step.
  const step = Math.round(share * 200) / 200;
  const key = `${place.latitude.toFixed(1)},${place.longitude.toFixed(1)},${String(step)}`;
  const known = scales.get(key);
  if (known !== undefined) return known;
  const target = step * OCEAN_SHARE;
  let low = 0;
  let high = 8;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (coverOf(patchesAt(place, middle)) < target) low = middle;
    else high = middle;
  }
  scales.set(key, high);
  return high;
}

/** An extinction's oxygen-poor seas: the share of seafloor drawn at a moment, and whose it is. */
export interface AnoxicExtent {
  /** The record's place the water is drawn round, where the clock does not already name one. */
  readonly site?: string;
  /** The share of the seafloor drawn as oxygen-poor, 0–1, `seconds` since the clock's zero. */
  share(seconds: number): number;
  /** Whose estimate, and what is drawn rather than measured. */
  readonly says: string;
}

/** Rising from 0 at `from` to 1 at `to`, seconds; falling if `to` is before `from`. */
function ramp(seconds: number, from: number, to: number): number {
  return clamp01((seconds - from) / (to - from));
}

const WHERE =
  'Where the water lay is not mapped by these studies: it is drawn round the record’s place, over the sea only, so less where it meets land.';

/** Along `points`, [kyr, share] in order: straight between them, nothing before or after. */
function along(seconds: number, points: readonly (readonly [number, number])[]): number {
  const kyr = seconds / KYR;
  for (let index = 1; index < points.length; index += 1) {
    const [toKyr, toShare] = points[index] ?? [0, 0];
    const [fromKyr, fromShare] = points[index - 1] ?? [0, 0];
    if (kyr >= fromKyr && kyr <= toKyr) {
      return fromShare + ((toShare - fromShare) * (kyr - fromKyr)) / (toKyr - fromKyr);
    }
  }
  return 0;
}

/**
 * The end-Triassic's, as Somlyay et al. (2023) model it (their Fig. 4D, C-P-U model, smoothed):
 * 1–3% in the extinction's main phase, 13% some 200–250 kyr on, then 1–6% through the
 * Hettangian, 0.7–1.5% by 1.9 Myr; their study runs to 2 Myr.
 */
const TRIASSIC: readonly (readonly [number, number])[] = [
  [0, 0],
  [50, 0.02],
  [225, 0.13],
  [600, 0.03],
  [1900, 0.015],
  [2000, 0.01],
];

/** The end-Permian's (Pimentel-Galvan et al. 2022): 18% at its height, 7.8% in the aftermath. */
const PERMIAN = { most: 0.18, after: 0.078 } as const;

/** Each extinction's oxygen-poor seas, by the extinction it is watched for. */
export const ANOXIC_EXTENTS: Readonly<Record<string, AnoxicExtent>> = {
  'end-ordovician-extinction': {
    share: () => 0.15,
    says: `Oxygen-poor water drawn over 15% of the seafloor, as Bartlett et al. (2018) estimate from uranium isotopes for the Hirnantian ocean anoxic event, up from near none; most of it, they find, in deeper water beyond the shelves. ${WHERE}`,
  },
  'late-devonian-extinction': {
    share: () => 0.1,
    says: `Oxygen-poor water drawn over 10% of the seafloor, the middle of the 5–15% increase White et al. (2018) estimate from uranium isotopes for two shifts: one in the late Frasnian, with the lower Kellwasser, and one in the early Famennian, after the upper. ${WHERE}`,
  },
  'end-permian-extinction': {
    site: 'meishan',
    share: (seconds) =>
      PERMIAN.most * ramp(seconds, 0, 61 * KYR) -
      (PERMIAN.most - PERMIAN.after) * ramp(seconds, 200 * KYR, 1200 * KYR) -
      PERMIAN.after * ramp(seconds, 1700 * KYR, 2000 * KYR),
    says: `Oxygen-poor water drawn rising over the extinction to 18% of the seafloor, as Pimentel-Galvan et al. (2022) best fit their uranium isotopes (95% interval 11–47%, lasting 20,000 years to 1.2 million), then easing to the 7.8% of its aftermath; Zhang et al. (2018) give 17–60%, from about 0.2% before. Beyond the 1.7 million years their study spans, it is not drawn. ${WHERE} Drawn round Meishan, where many of its records are.`,
  },
  'end-triassic-extinction': {
    site: 'kuhjoch',
    share: (seconds) => along(seconds, TRIASSIC),
    says: `Oxygen-poor water drawn as Somlyay et al. (2023) model it from uranium isotopes in Hungary: 1–3% of the seafloor as the extinction strikes, 13% some 200,000–250,000 years later, then 1–6% through the earliest Jurassic; their simpler uranium model gives 11%. Bond et al. (2023), from molybdenum isotopes, find the sulfide-rich kind severe on shallow shelves but, worldwide, no more widespread than today, with little sign of the open ocean losing its oxygen. ${WHERE} Drawn round Kuhjoch, in the western Tethys, where it is best recorded.`,
  },
};
