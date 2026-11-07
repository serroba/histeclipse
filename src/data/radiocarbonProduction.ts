/**
 * How fast cosmic rays make carbon-14 in the air, by latitude, for a given magnetic field and
 * Sun (#269): the model of Kovaltsov, Mishev & Usoskin (2012). Their yield function (Table A.1,
 * the carbon-14 made in the whole column of air by one primary nucleon of a given energy) is
 * weighed against the cosmic rays reaching the top of the air (the local interstellar spectrum,
 * Burger et al. 2000 as in Usoskin et al. 2005, slowed by the Sun's modulation potential φ) above
 * the rigidity the field turns away (Elsasser's cutoff, 1.9·M·cos⁴λ GV). Protons and heavier
 * nuclei, taken as α-particles, at 0.3 nucleons for each proton's.
 *
 * Rates are atoms of carbon-14 per cm² of Earth's surface per second. The latitude is the
 * geomagnetic one; the globe draws it about the spin axis, which the field lines up with when
 * averaged over thousands of years.
 */

import { elementAt, valueAt } from '../util/arrays';

/** Today's dipole moment, 10²² A m², as the model's authors take it. */
export const DIPOLE_TODAY = 7.8;

/** Energies of the yield function, GeV per nucleon. */
const ENERGIES = [0.1, 0.3, 0.5, 0.7, 1, 3, 7, 10, 19, 49, 99, 499, 999] as const;
/** Table A.1: atoms sr per nucleon, over π, for protons and for α-particles (per nucleon). */
const YIELD_PROTON = [
  0.025, 0.26, 0.72, 1.29, 2.07, 5.19, 8.32, 9.72, 12.4, 17.45, 23.24, 48.3, 72.73,
] as const;
const YIELD_ALPHA = [
  0.036, 0.38, 0.89, 1.55, 2.16, 4.18, 7.17, 8.67, 12.4, 17.45, 23.24, 48.3, 72.73,
] as const;

/** A proton's rest energy, GeV. */
const REST = 0.938;
/** Nucleons in heavier cosmic rays for each in protons, outside the heliosphere. */
const HEAVY_SHARE = 0.3;

interface Species {
  /** Charge over mass number. */
  readonly zOverA: number;
  readonly share: number;
  readonly yields: readonly number[];
}

const SPECIES: readonly Species[] = [
  { zOverA: 1, share: 1, yields: YIELD_PROTON },
  { zOverA: 0.5, share: HEAVY_SHARE, yields: YIELD_ALPHA },
];

/** The energy grid the integrals run over: even steps of log energy across the table. */
const STEPS = 240;
const GRID = Array.from({ length: STEPS + 1 }, (_, i) => {
  const low = Math.log(ENERGIES[0]);
  const high = Math.log(valueAt(ENERGIES, ENERGIES.length - 1));
  return Math.exp(low + ((high - low) * i) / STEPS);
});

/** The yield at `energy`, between the table's rows on log–log scales. */
function yieldAt(yields: readonly number[], energy: number): number {
  let i = 1;
  while (i < ENERGIES.length - 1 && valueAt(ENERGIES, i) < energy) i += 1;
  const e0 = valueAt(ENERGIES, i - 1);
  const e1 = valueAt(ENERGIES, i);
  const y0 = valueAt(yields, i - 1);
  const y1 = valueAt(yields, i);
  const t = Math.log(energy / e0) / Math.log(e1 / e0);
  return Math.PI * Math.exp(Math.log(y0) + t * (Math.log(y1) - Math.log(y0)));
}

/** Rigidity, GV, of a nucleus of `zOverA` with `energy` GeV per nucleon. */
function rigidity(energy: number, zOverA: number): number {
  return Math.sqrt(energy * (energy + 2 * REST)) / zOverA;
}

/** The interstellar proton spectrum, per (m² sr s GeV/nucleon). */
function interstellar(energy: number): number {
  const p = Math.sqrt(energy * (energy + 2 * REST));
  return (1.9e4 * p ** -2.78) / (1 + 0.4866 * p ** -2.51);
}

/** The spectrum at Earth's orbit, slowed by the Sun's modulation potential `phi`, MV. */
function modulated(energy: number, phi: number, zOverA: number): number {
  const lost = (zOverA * phi) / 1000;
  return (
    (interstellar(energy + lost) * energy * (energy + 2 * REST)) /
    ((energy + lost) * (energy + lost + 2 * REST))
  );
}

/** Each species' production per energy step, before the field's cutoff. */
function integrand(species: Species, phi: number): readonly number[] {
  return GRID.map(
    (energy) =>
      species.share *
      yieldAt(species.yields, energy) *
      modulated(energy, phi, species.zOverA) *
      // Per m² to per cm².
      1e-4,
  );
}

/** The field's cutoff rigidity, GV, at geomagnetic latitude `latitude`° for dipole `dipole`. */
export function cutoffRigidity(latitude: number, dipole: number): number {
  return 1.9 * dipole * Math.cos((latitude * Math.PI) / 180) ** 4;
}

/**
 * Carbon-14 made over a place at geomagnetic latitude `latitude`°, atoms per cm² per second,
 * for a dipole of `dipole` ×10²² A m² and a Sun of modulation potential `phi` MV.
 */
export function localProduction(latitude: number, dipole: number, phi: number): number {
  const cutoff = cutoffRigidity(latitude, dipole);
  let total = 0;
  for (const species of SPECIES) {
    const values = integrand(species, phi);
    for (let i = 1; i < GRID.length; i += 1) {
      const e0 = valueAt(GRID, i - 1);
      const e1 = valueAt(GRID, i);
      // Only cosmic rays stiffer than the cutoff reach the air.
      if (rigidity(e1, species.zOverA) < cutoff) continue;
      total += (valueAt(values, i - 1) + valueAt(values, i)) * 0.5 * (e1 - e0);
    }
  }
  return total;
}

/** Production by latitude, every `step`° from the equator to the pole. */
export function productionProfile(dipole: number, phi: number, step = 5): readonly number[] {
  return Array.from({ length: Math.round(90 / step) + 1 }, (_, i) =>
    localProduction(i * step, dipole, phi),
  );
}

/** The global average, atoms per cm² per second: each latitude weighed by its area. */
export function globalProduction(dipole: number, phi: number): number {
  const step = 1;
  const profile = productionProfile(dipole, phi, step);
  let total = 0;
  let area = 0;
  for (let i = 1; i < profile.length; i += 1) {
    const middle = ((i - 0.5) * step * Math.PI) / 180;
    const weight = Math.cos(middle);
    total += ((valueAt(profile, i - 1) + valueAt(profile, i)) / 2) * weight;
    area += weight;
  }
  return total / area;
}

export interface FieldChoice {
  readonly id: string;
  readonly label: string;
  /** Dipole moment, ×10²² A m². */
  readonly dipole: number;
  readonly note: string;
}

export interface SunChoice {
  readonly id: string;
  readonly label: string;
  /** Modulation potentials, MV: production is averaged over them. */
  readonly phis: readonly number[];
  readonly note: string;
}

export const FIELD_CHOICES: readonly FieldChoice[] = [
  {
    id: 'today',
    label: 'Today',
    dipole: DIPOLE_TODAY,
    note: 'Today’s field, 7.8 × 10²² A m² (Kovaltsov et al. 2012).',
  },
  {
    id: 'holocene-strong',
    label: 'Strongest since the ice age',
    dipole: 10,
    note: 'About 10 × 10²² A m², the strongest of the last 10,000 years (Korte et al. 2011, as Kovaltsov et al. 2012 take it).',
  },
  {
    id: 'holocene-weak',
    label: 'Weakest since the ice age',
    dipole: 6,
    note: 'About 6 × 10²² A m², the weakest of the last 10,000 years (Korte et al. 2011, as Kovaltsov et al. 2012 take it).',
  },
  {
    id: 'laschamp',
    label: 'Laschamp excursion, 41,000 years ago',
    dipole: 0.3,
    note: 'Most field models put the dipole below 0.4 × 10²² A m², under a twentieth of today’s; smoother ones, such as GGF100k, put it higher (Korte et al. 2019). Drawn at 0.3.',
  },
  {
    id: 'none',
    label: 'No field',
    dipole: 0,
    note: 'No magnetic shield at all: every cosmic ray reaches the air.',
  },
];

export const SUN_CHOICES: readonly SunChoice[] = [
  {
    id: 'cycle',
    label: 'An average solar cycle',
    phis: [300, 1200],
    note: 'Halfway between a quiet Sun and an active one: the Sun’s modulation potential swings between about 300 and 1200 MV over a cycle of about 11 years (Kovaltsov et al. 2012).',
  },
  {
    id: 'quiet',
    label: 'Quiet Sun (solar minimum)',
    phis: [300],
    note: 'A quiet Sun, modulation potential about 300 MV: its weaker wind lets more cosmic rays in.',
  },
  {
    id: 'active',
    label: 'Active Sun (solar maximum)',
    phis: [1200],
    note: 'An active Sun, modulation potential about 1200 MV: its wind turns more cosmic rays away.',
  },
  {
    id: 'maunder',
    label: 'Maunder Minimum, 1645–1715',
    phis: [100],
    note: 'Decades with almost no sunspots, modulation potential as low as about 100 MV (Kovaltsov et al. 2012).',
  },
];

/** Production by latitude for a field and a Sun, every `step`°, averaged over the Sun's states. */
export function profileFor(field: FieldChoice, sun: SunChoice, step = 5): readonly number[] {
  const each = sun.phis.map((phi) => productionProfile(field.dipole, phi, step));
  return elementAt(each, 0).map(
    (_, i) => each.reduce((sum, profile) => sum + valueAt(profile, i), 0) / each.length,
  );
}

/** The global average for a field and a Sun, atoms per cm² per second. */
export function globalFor(field: FieldChoice, sun: SunChoice): number {
  return (
    sun.phis.reduce((sum, phi) => sum + globalProduction(field.dipole, phi), 0) / sun.phis.length
  );
}

/** Carbon-14 decays by half every this many years (Godwin 1962). */
export const HALF_LIFE = 5730;
/** Beyond about this many years too little carbon-14 is left to measure. */
export const DATABLE_YEARS = 50_000;
