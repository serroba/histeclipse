/**
 * The steps of a cosmic-ray shower making carbon-14 (#269), as the animation plays them: when
 * each begins, and what its caption says. The rays come from far beyond the Sun; the field
 * turns them away near the equator unless it is weak.
 */

import { cutoffRigidity } from '../data/radiocarbonProduction';
import type { GeoPoint } from '../state/viewState';

export type ShowerStep = 'rays' | 'shower' | 'capture' | 'dioxide' | 'fall' | 'plant';

/** When each step begins, ms from the start. */
export const SHOWER_STEPS: readonly { readonly step: ShowerStep; readonly at: number }[] = [
  { step: 'rays', at: 0 },
  { step: 'shower', at: 2200 },
  { step: 'capture', at: 5000 },
  { step: 'dioxide', at: 7200 },
  { step: 'fall', at: 9200 },
  { step: 'plant', at: 12_400 },
];

/** The shower bursts this long into its step, once the view has come in close, ms. */
export const BURST_DELAY = 900;

/** How long the whole plays, ms. */
export const SHOWER_MS = 16_000;

/**
 * Below this cutoff at the equator, GV, the equator's ray is let in: nearly all the cosmic rays
 * that make carbon-14 are stiffer (Kovaltsov et al. 2012: half the production is from rays
 * above 4–10 GeV per nucleon, about 5–11 GV for a proton).
 */
export const LET_IN_GV = 2;

/** How far the carbon dioxide falls toward the equator from where it was made, degrees. */
export const FALL_DEGREES = 2.9;

/** Where the carbon dioxide reaches the ground: a little toward the equator from `place`. */
export function landing(place: GeoPoint): GeoPoint {
  return { latitude: place.latitude - FALL_DEGREES, longitude: place.longitude };
}

/** A proton's rest energy, GeV. */
const PROTON_GEV = 0.938;

/** The kinetic energy, GeV, of a proton just stiff enough to reach the equator through the field. */
export function equatorCutoffGeV(dipole: number): number {
  const rigidity = cutoffRigidity(0, dipole);
  return Math.sqrt(rigidity ** 2 + PROTON_GEV ** 2) - PROTON_GEV;
}

/** What the two rays' labels say: the one near the pole, and the one at the equator. */
export function rayLabels(dipole: number): { readonly polar: string; readonly equator: string } {
  return {
    // Half of carbon-14 is made by rays above 4–10 GeV per nucleon (Kovaltsov et al. 2012).
    polar: 'Cosmic ray: a proton of a few GeV',
    equator: turnedAway(dipole)
      ? `Turned away: under ${String(Math.round(equatorCutoffGeV(dipole)))} GeV`
      : 'Let in: the field is too weak to turn it',
  };
}

/** Whether the field turns away a ray aimed at the equator. */
export function turnedAway(dipole: number): boolean {
  return cutoffRigidity(0, dipole) >= LET_IN_GV;
}

/** The step playing at `t` ms; null once it has played out. */
export function stepAt(t: number): ShowerStep | null {
  if (t < 0 || t >= SHOWER_MS) return null;
  let current: ShowerStep = 'rays';
  for (const { step, at } of SHOWER_STEPS) if (t >= at) current = step;
  return current;
}

/**
 * What a step's caption says, for a field of `dipole` ×10²² A m², the carbon landing on water
 * (`water`) or on land.
 */
export function captionOf(step: ShowerStep, dipole: number, water = false): string {
  switch (step) {
    case 'rays':
      return turnedAway(dipole)
        ? 'Cosmic rays, nuclei from far beyond the Sun, race in. Near the equator Earth’s magnetic field bends this one back out to space.'
        : 'Cosmic rays, nuclei from far beyond the Sun, race in. With the field this weak, they reach the air at the equator too.';
    case 'shower':
      return 'Away from the equator the field lets it through. It strikes the air high up and bursts into a shower of particles.';
    case 'capture':
      return 'A neutron from the shower hits a nitrogen-14 atom (blue). It becomes carbon-14 (violet), and a proton (yellow) flies off: n + ¹⁴N → ¹⁴C + p.';
    case 'dioxide':
      return 'The carbon-14 joins two oxygen atoms (red): carbon dioxide, like any other.';
    case 'fall':
      return 'The carbon dioxide falls and mixes through the air, over a few years: here, a few seconds. (Not to scale: a shower is kilometres across.)';
    case 'plant':
      if (water)
        return 'Algae in the sea take it in by photosynthesis. The ocean takes in carbon dioxide slowly and holds it for centuries, so a sea shell reads about 400–600 radiocarbon years older than a land plant of the same year.';
      return 'A leaf takes it in by photosynthesis, and the carbon-14 becomes part of the plant. When the plant dies the intake stops, and the clock starts: half is gone every 5,730 years.';
  }
}
