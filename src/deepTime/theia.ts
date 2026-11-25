/**
 * How the Moon-forming impact went (#1220), argued over: each scenario a hit the formation clock
 * draws, with whose simulations it follows and what it is meant to explain. The Moon's isotopes
 * match Earth's too closely for the canonical impactor's debris (Zhang et al. 2012), so the others
 * are ways to make a Moon mostly of Earth's own mantle.
 *
 * Each hit's numbers are those its papers give, rounded; how the debris moves after it is drawn
 * as illustration.
 *
 * Pure.
 */

import type { Choice } from './sketch';

export const THEIA_MODELS = [
  'canonical',
  'fastSpin',
  'halfEarths',
  'synestia',
  'manyHits',
  'immediate',
] as const;
export type TheiaModel = (typeof THEIA_MODELS)[number];
export const DEFAULT_THEIA_MODEL: TheiaModel = 'canonical';

/** A hit as drawn: the bodies, how it struck, and what came of it. */
export interface Hit {
  /** Theia's radius, Earth radii. */
  readonly radius: number;
  /** Its speed, km/s. */
  readonly speedKm: number;
  /** How grazing: the offset of its path as a share of the sum of the radii (0 head on). */
  readonly graze: number;
  /** The proto-Earth's share of today's mass just before it. */
  readonly protoEarth: number;
  /**
   * A disc the Moon gathers from; a Moon thrown straight into orbit within hours; a synestia, a
   * vaporised doughnut the Moon condenses in; or moonlets from many hits, merging.
   */
  readonly outcome: 'disc' | 'immediate' | 'synestia' | 'moonlets';
}

export interface TheiaChoice extends Choice<TheiaModel> {
  readonly hit: Hit;
  readonly note: string;
}

export const THEIA_CHOICES: Readonly<Record<TheiaModel, TheiaChoice>> = {
  canonical: {
    id: 'canonical',
    label: 'Canonical: a Mars-sized body, grazing',
    hit: { radius: 0.53, speedKm: 9.3, graze: 0.75, protoEarth: 0.89, outcome: 'disc' },
    note: 'A body about Mars’s size strikes a glancing blow at about Earth’s escape speed, late in Earth’s growth; the Moon gathers from the disc of debris. It gives the Earth–Moon system its angular momentum, but makes the Moon mostly of Theia.',
    source: 'Canup & Asphaug 2001, Nature 412',
    url: 'https://doi.org/10.1038/35089010',
  },
  fastSpin: {
    id: 'fastSpin',
    label: 'Fast spin: a small, fast impactor, Earth spinning fast',
    hit: { radius: 0.37, speedKm: 20, graze: 0.35, protoEarth: 0.95, outcome: 'disc' },
    note: 'A smaller body, a few hundredths of Earth’s mass, strikes much faster an Earth spinning in two to three hours; the disc is made mostly of Earth’s mantle. A resonance with the Sun then drains the extra spin, to the angular momentum the system has.',
    source: 'Ćuk & Stewart 2012, Science 338',
    url: 'https://doi.org/10.1126/science.1225542',
  },
  halfEarths: {
    id: 'halfEarths',
    label: 'Half-Earths: two bodies of similar size',
    hit: { radius: 0.77, speedKm: 9.3, graze: 0.6, protoEarth: 0.55, outcome: 'disc' },
    note: 'Two bodies of about half Earth’s mass each collide slowly and mix so well that the Moon and Earth come out alike in composition.',
    source: 'Canup 2012, Science 338',
    url: 'https://doi.org/10.1126/science.1226073',
  },
  synestia: {
    id: 'synestia',
    label: 'Synestia: Earth vaporised into a doughnut',
    hit: { radius: 0.5, speedKm: 15, graze: 0.6, protoEarth: 0.9, outcome: 'synestia' },
    note: 'A high-energy, high-angular-momentum impact leaves Earth a synestia, a doughnut of rock vapour larger than the planet. Moonlets condense inside it, take on its isotopes and grow into the Moon, until the cooling synestia shrinks back inside the Moon’s orbit. How long that takes is drawn as a guess: about a decade.',
    source: 'Lock et al. 2018, Journal of Geophysical Research: Planets 123',
    url: 'https://doi.org/10.1002/2017JE005333',
  },
  manyHits: {
    id: 'manyHits',
    label: 'Many hits: moonlets merging',
    hit: { radius: 0.3, speedKm: 15, graze: 0.5, protoEarth: 0.95, outcome: 'moonlets' },
    note: 'A series of smaller impacts, some twenty in their simulations, each throws out a disc that gathers into a moonlet; the moonlets move outward and merge into the Moon, made mostly of Earth’s own rock. Drawn as six hits, the Moon growing with each; their spacing is invented.',
    source: 'Rufu, Aharonson & Perets 2017, Nature Geoscience 10',
    url: 'https://doi.org/10.1038/ngeo2866',
  },
  immediate: {
    id: 'immediate',
    label: 'Immediate: the Moon thrown straight into orbit, in hours',
    hit: { radius: 0.53, speedKm: 9.3, graze: 0.75, protoEarth: 0.89, outcome: 'immediate' },
    note: 'Simulations fine enough show the impact throwing a Moon-sized body, its outer layers molten and about 60% proto-Earth, straight into an orbit far outside the Roche limit within hours, with no disc to gather from.',
    source: 'Kegerreis et al. 2022, The Astrophysical Journal Letters 937',
    url: 'https://doi.org/10.3847/2041-8213/ac8d96',
  },
};
