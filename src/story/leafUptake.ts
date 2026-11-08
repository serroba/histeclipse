/**
 * The carbon-14's way into a plant, as the 3D story draws it (#317): it is oxidised, first to
 * carbon monoxide, then to carbon dioxide; it mixes down through the air among a great many
 * other molecules; and it enters a leaf through a stoma, where chlorophyll, taking in the red
 * photon that left the Sun, makes it part of a sugar. Over the sea, an alga takes it in.
 *
 * The air's make-up is the dry atmosphere's by volume; the photon's energy comes from its
 * wavelength (`sunlightJourney.ts`), which is the wavelength photosystem II's chlorophyll pair
 * absorbs best, P680.
 */

import { seeded } from './seeded';
import { electronVolts, RED_NM } from './sunlightJourney';

export type Point = readonly [x: number, y: number, z: number];

/** The molecules of dry air drawn round the carbon dioxide. */
export type Molecule = 'nitrogen' | 'oxygen' | 'argon';

/** Dry air by volume, parts in 10,000. */
export const AIR_PARTS: Readonly<Record<Molecule | 'carbonDioxide', number>> = {
  nitrogen: 7808,
  oxygen: 2095,
  argon: 93,
  carbonDioxide: 4,
};

/** How many carbon atoms there are for each carbon-14 one: about a trillion. */
export const CARBON_PER_C14 = 1 / 1.2e-12;

/** The half-life of carbon-14, years (Cambridge value). */
export const HALF_LIFE_YEARS = 5730;

/** How much carbon-14 is left after `years`, as a fraction of what the plant had. */
export function remaining(years: number): number {
  return 0.5 ** (years / HALF_LIFE_YEARS);
}

/**
 * `count` molecules of air, round the origin in a box `size` across: nitrogen, oxygen and argon
 * in their proportions, each at a place and turned its own way, the same every time.
 */
export function airAround(
  count: number,
  size: number,
): readonly { readonly kind: Molecule; readonly at: Point; readonly turn: Point }[] {
  const total = AIR_PARTS.nitrogen + AIR_PARTS.oxygen + AIR_PARTS.argon;
  const random = seeded(12_345);
  const molecules: { kind: Molecule; at: Point; turn: Point }[] = [];
  for (let i = 0; i < count; i += 1) {
    // Kinds dealt out in proportion, by where each falls in the running total.
    const share = ((i + 0.5) / count) * total;
    const kind: Molecule =
      share < AIR_PARTS.nitrogen
        ? 'nitrogen'
        : share < AIR_PARTS.nitrogen + AIR_PARTS.oxygen
          ? 'oxygen'
          : 'argon';
    let at: Point = [0, 0, 0];
    // Keep clear of the carbon dioxide at the centre.
    while (Math.hypot(...at) < size * 0.12) {
      at = [(random() - 0.5) * size, (random() - 0.5) * size, (random() - 0.5) * size];
    }
    molecules.push({
      kind,
      at,
      turn: [random() * Math.PI, random() * Math.PI, random() * Math.PI],
    });
  }
  return molecules;
}

/** The facts written beside the carbon dioxide being made. */
export const DIOXIDE_FACTS: readonly string[] = [
  '¹⁴C + O → ¹⁴CO: carbon monoxide first',
  '¹⁴CO + OH → ¹⁴CO₂ + H: carbon dioxide, within a few months',
  'Chemically like any other carbon dioxide: O=C=O, in a line',
];

/** The facts written beside its fall through the air. */
export const FALL_FACTS: readonly string[] = [
  `In 10,000 molecules of dry air: ${AIR_PARTS.nitrogen.toLocaleString('en')} nitrogen, ${AIR_PARTS.oxygen.toLocaleString('en')} oxygen, ${String(AIR_PARTS.argon)} argon, about ${String(AIR_PARTS.carbonDioxide)} carbon dioxide (today)`,
  'About one carbon atom in a trillion is carbon-14',
  'It mixes down through the air over a few years: here, a few seconds',
];

/** The facts written beside it entering the plant, on land or at sea. */
export function plantFacts(water: boolean, fromSun: boolean): readonly string[] {
  return [
    '6 CO₂ + 6 H₂O + light → C₆H₁₂O₆ + 6 O₂',
    water
      ? 'In through the alga’s surface: a single cell, with no stomata'
      : 'In through a stoma, a pore between two guard cells, mostly on the leaf’s underside',
    fromSun
      ? `Chlorophyll in photosystem II absorbs best at ${String(RED_NM)} nm (P680): the red photon’s ${electronVolts(RED_NM).toFixed(1)} eV`
      : `Chlorophyll absorbs red and blue light, and reflects the green`,
    `When it dies the intake stops: half the carbon-14 is gone every ${HALF_LIFE_YEARS.toLocaleString('en')} years`,
  ];
}
