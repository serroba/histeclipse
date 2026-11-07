/**
 * The steps of a cosmic-ray shower making carbon-14 (#269), as the animation plays them: when
 * each begins, and what its caption says. The rays come from far beyond the Sun; the field
 * turns them away near the equator unless it is weak.
 */

import { cutoffRigidity } from '../data/radiocarbonProduction';

export type ShowerStep = 'rays' | 'shower' | 'capture' | 'dioxide' | 'drift';

/** When each step begins, ms from the start. */
export const SHOWER_STEPS: readonly { readonly step: ShowerStep; readonly at: number }[] = [
  { step: 'rays', at: 0 },
  { step: 'shower', at: 2200 },
  { step: 'capture', at: 5000 },
  { step: 'dioxide', at: 7200 },
  { step: 'drift', at: 9200 },
];

/** The shower bursts this long into its step, once the view has come in close, ms. */
export const BURST_DELAY = 900;

/** How long the whole plays, ms. */
export const SHOWER_MS = 12_000;

/**
 * Below this cutoff at the equator, GV, the equator's ray is let in: nearly all the cosmic rays
 * that make carbon-14 are stiffer (Kovaltsov et al. 2012: half the production is from rays
 * above 4–10 GeV per nucleon, about 5–11 GV for a proton).
 */
export const LET_IN_GV = 2;

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

/** What a step's caption says, for a field of `dipole` ×10²² A m². */
export function captionOf(step: ShowerStep, dipole: number): string {
  switch (step) {
    case 'rays':
      return turnedAway(dipole)
        ? 'Cosmic rays, nuclei from far beyond the Sun, race in. Near the equator Earth’s magnetic field bends this one back out to space.'
        : 'Cosmic rays, nuclei from far beyond the Sun, race in. With the field this weak, they reach the air at the equator too.';
    case 'shower':
      return 'Near the pole the field lets it through. It strikes the air high up and bursts into a shower of particles.';
    case 'capture':
      return 'A neutron from the shower hits a nitrogen-14 atom (blue). It becomes carbon-14 (violet), and a proton (yellow) flies off: n + ¹⁴N → ¹⁴C + p.';
    case 'dioxide':
      return 'The carbon-14 joins two oxygen atoms (red): carbon dioxide, like any other.';
    case 'drift':
      return 'It mixes through the air within a few years, and plants take it in as they grow. (Not to scale: a shower is kilometres across.)';
  }
}
