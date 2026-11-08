/**
 * The steps of a cosmic-ray shower making carbon-14 (#269), as the animation plays them: when
 * each begins, and what its caption says. The rays come from far beyond the Sun; the field
 * turns them away near the equator unless it is weak. Started from the Sun (#277), three steps
 * come first: fusion in its core, a photon's long escape, and its journey to Earth, where at the
 * end it is the light the leaf takes the carbon in by.
 */

import { cutoffRigidity } from '../data/radiocarbonProduction';
import type { GeoPoint } from '../state/viewState';

export type ShowerStep =
  'fusion' | 'escape' | 'journey' | 'rays' | 'shower' | 'capture' | 'dioxide' | 'fall' | 'plant';

export interface StepStart {
  readonly step: ShowerStep;
  readonly at: number;
}

/** When each step begins, ms from the start. */
export const SHOWER_STEPS: readonly StepStart[] = [
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

/** The Sun's steps, before the shower, ms from their start. */
const SUN_STEPS: readonly StepStart[] = [
  { step: 'fusion', at: 0 },
  { step: 'escape', at: 9000 },
  { step: 'journey', at: 17_000 },
];

/** How long the Sun's steps take, ms. */
export const SUN_MS = 22_000;

/** A story to play: its steps in order, how long it lasts, and where the shower begins in it. */
export interface Story {
  readonly steps: readonly StepStart[];
  readonly total: number;
  /** Where the shower's own steps begin, ms from the story's start. */
  readonly offset: number;
}

export const SHOWER_STORY: Story = { steps: SHOWER_STEPS, total: SHOWER_MS, offset: 0 };

/** The story from the Sun: its three steps, then the shower's. */
export const SUN_STORY: Story = {
  steps: [...SUN_STEPS, ...SHOWER_STEPS.map(({ step, at }) => ({ step, at: at + SUN_MS }))],
  total: SUN_MS + SHOWER_MS,
  offset: SUN_MS,
};

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

/** Where the step after the one playing at `t` begins; the end, from the last. */
export function nextStepStart(t: number, story = SHOWER_STORY): number {
  return story.steps.find(({ at }) => at > t)?.at ?? story.total;
}

/**
 * Where "back" goes from `t`: the start of the step playing, if it has run a while (as a
 * player's back button does), else the start of the one before.
 */
export function previousStepStart(t: number, story = SHOWER_STORY): number {
  const current = story.steps.findLast(({ at }) => at <= t)?.at ?? 0;
  if (t - current > 800) return current;
  return story.steps.findLast(({ at }) => at < current)?.at ?? 0;
}

/** Just before the step after the one at `t` begins: where that step's picture is complete. */
export function stepEnd(t: number, story = SHOWER_STORY): number {
  return nextStepStart(t, story) - 1;
}

/** The step playing at `t` ms; null before the start or once it has played out. */
export function stepAt(t: number, story = SHOWER_STORY): ShowerStep | null {
  if (t < 0 || t >= story.total) return null;
  return story.steps.findLast(({ at }) => at <= t)?.step ?? null;
}

/**
 * What a step's caption says, for a field of `dipole` ×10²² A m², the carbon landing on water
 * (`water`) or on land, and the story begun at the Sun (`fromSun`) or not.
 */
export function captionOf(
  step: ShowerStep,
  dipole: number,
  water = false,
  fromSun = false,
): string {
  const sunlight = fromSun
    ? ' The red sunlight it needs set out from the Sun eight minutes ago, and from its core some 170,000 years before.'
    : '';
  switch (step) {
    case 'fusion':
      return 'In the Sun’s core, at about 15 million degrees, hydrogen nuclei fuse into helium. Each positron the chain makes meets an electron and becomes gamma rays: light of 0.511 MeV, 1.2 × 10²⁰ Hz.';
    case 'escape':
      return 'That light cannot fly out. It is absorbed and given off again countless times, a random walk, softening from X-rays to visible light. About 170,000 years to reach the surface (Mitalas & Sills 1992); quick estimates give ten times less.';
    case 'journey':
      return 'From the surface, at 5,772 K, sunlight crosses 150 million km to Earth in 8 minutes 19 seconds. One photon is red light, 680 nm: 441 THz, 1.8 eV.';
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
        return `Algae in the sea take it in by photosynthesis. The ocean takes in carbon dioxide slowly and holds it for centuries, so a sea shell reads about 400–600 radiocarbon years older than a land plant of the same year.${sunlight}`;
      return fromSun
        ? 'The red photon reaches a leaf. Chlorophyll absorbs it (it reflects the green, which is why leaves look green), and its energy draws the carbon dioxide in: the carbon-14 becomes part of the plant. When the plant dies the clock starts: half is gone every 5,730 years.'
        : 'A leaf takes it in by photosynthesis, and the carbon-14 becomes part of the plant. When the plant dies the intake stops, and the clock starts: half is gone every 5,730 years.';
  }
}
