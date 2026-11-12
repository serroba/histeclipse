/**
 * The reaction that makes carbon-14, as the 3D story draws it (#317): a slow neutron enters a
 * nitrogen-14 nucleus (7 protons, 7 neutrons); for an instant it is nitrogen-15, then a proton
 * leaves, and carbon-14 (6 protons, 8 neutrons) remains: n + ¹⁴N → ¹⁴C + p.
 *
 * The energy it gives off comes from the four masses (AME2020 mass excesses); the proton and
 * the carbon-14 share it in inverse proportion to their masses, as momentum is conserved from a
 * neutron nearly at rest. A nucleus's size comes from its mass number: r = 1.2 A^⅓ fm.
 * Lengths are in femtometres (10⁻¹⁵ m).
 */

type Point = readonly [x: number, y: number, z: number];
type Nucleon = 'proton' | 'neutron';

/** Mass excesses, keV (AME2020): what each weighs beyond its mass number in atomic mass units. */
const EXCESS_KEV = {
  neutron: 8071.318,
  hydrogen1: 7288.971,
  nitrogen14: 2863.417,
  carbon14: 3019.893,
} as const;

/** The energy the reaction gives off, MeV: about 0.63. */
export const Q_MEV =
  (EXCESS_KEV.neutron + EXCESS_KEV.nitrogen14 - EXCESS_KEV.carbon14 - EXCESS_KEV.hydrogen1) / 1000;
/** The proton's share, MeV: momentum shared equally, energy in inverse proportion to mass. */
export const PROTON_MEV = (Q_MEV * 14) / 15;
/** The carbon-14's recoil, MeV. */
export const RECOIL_MEV = Q_MEV / 15;

/** A nucleon's radius, fm (about the proton's charge radius, 0.84). */
export const NUCLEON_FM = 0.85;

/** A nucleus's radius, fm, from its mass number. */
export function nuclearRadius(massNumber: number): number {
  return 1.2 * Math.cbrt(massNumber);
}

/** One nucleon's place in the nucleus, and what it is. */
interface Slot {
  readonly at: Point;
  readonly kind: Nucleon;
}

/** The nucleus at each moment: nitrogen-14, nitrogen-15 for an instant, carbon-14. */
export interface Capture {
  /** All fifteen places, the compound nucleus nitrogen-15's. */
  readonly slots: readonly Slot[];
  /** Where the neutron comes in: the place on the left, empty in nitrogen-14. */
  readonly arrives: number;
  /** Which proton leaves: the one furthest to the right. */
  readonly leaves: number;
}

/**
 * Fifteen nucleons packed in a ball the size of nitrogen-15, spread evenly by a spiral: 7
 * protons and 8 neutrons. The neutron's place is the leftmost neutron's; the proton that leaves,
 * the rightmost proton.
 */
export function capture(): Capture {
  const count = 15;
  const radius = nuclearRadius(count) - NUCLEON_FM * 0.8;
  const slots: Slot[] = [];
  for (let i = 0; i < count; i += 1) {
    // A Fibonacci spiral over the sphere, and out from the centre so the ball is evenly filled.
    const z = 1 - (2 * (i + 0.5)) / count;
    const turn = i * 2.399963229728653;
    const across = Math.sqrt(1 - z * z);
    const out = radius * Math.cbrt((i + 0.5) / count);
    slots.push({
      at: [out * across * Math.cos(turn), out * z, out * across * Math.sin(turn)],
      kind: i % 2 === 0 ? 'neutron' : 'proton',
    });
  }
  const pick = (kind: Nucleon, sign: number): number => {
    let best = -1;
    for (const [index, slot] of slots.entries()) {
      if (slot.kind !== kind) continue;
      const chosen = slots[best];
      if (chosen === undefined || sign * slot.at[0] > sign * chosen.at[0]) best = index;
    }
    return best;
  };
  return { slots, arrives: pick('neutron', -1), leaves: pick('proton', 1) };
}

/** Which stage the reaction is at. */
export type Stage = 'nitrogen' | 'compound' | 'carbon';

/** How many protons and neutrons the nucleus holds at a stage. */
export function makeUp(stage: Stage): { readonly protons: number; readonly neutrons: number } {
  switch (stage) {
    case 'nitrogen':
      return { protons: 7, neutrons: 7 };
    case 'compound':
      return { protons: 7, neutrons: 8 };
    case 'carbon':
      return { protons: 6, neutrons: 8 };
  }
}

/** The element a nucleus is, by its protons: what makes nitrogen nitrogen, and carbon carbon. */
export function element(protons: number): string {
  return protons === 7 ? 'nitrogen' : protons === 6 ? 'carbon' : `element ${String(protons)}`;
}

const mev = (value: number): string => value.toFixed(2);

/** The facts written beside the reaction. */
export const REACTION_FACTS: readonly string[] = [
  'n + ¹⁴N → ¹⁴C + p',
  'Nitrogen-14: 7 protons, 7 neutrons',
  'Carbon-14: 6 protons, 8 neutrons. One proton fewer makes it carbon; two neutrons more than common carbon-12 make it unstable',
  `It gives off ${mev(Q_MEV)} MeV: the proton flies off with ${mev(PROTON_MEV)}, the carbon-14 recoils with ${mev(RECOIL_MEV)}`,
  `The nucleus, about ${String(Math.round(2 * nuclearRadius(14)))} fm across (${String(Math.round(2 * nuclearRadius(14)))} × 10⁻¹⁵ m)`,
];
