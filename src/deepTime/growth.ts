/**
 * How fast Earth grew (#1219), argued over: slowly, by embryos colliding over tens of millions of
 * years, or fast, by pebbles drifting in through the gas disc within its few million years. The
 * formation clock draws Earth at the size the chosen model gives it, until Theia strikes.
 *
 * Both are simple curves fitted to what each side says, not the papers' own runs:
 * - slow: an exponential, the share still to come falling by e every 11 million years, the simple
 *   model hafnium–tungsten ages are read with (Kleine et al. 2009), as N-body runs of embryos
 *   colliding give (Chambers & Wetherill 1998);
 * - fast: growing ever faster as pebbles are swept up, to 80% of the proto-Earth by the time the
 *   gas is gone, about 4 million years (Johansen et al. 2021; Wang et al. 2017), the rest by
 *   collisions after.
 *
 * Before the impact, the proto-Earth is about nine tenths of today's mass: Theia brings the rest
 * (Canup & Asphaug 2001).
 *
 * Pure.
 */

import type { Choice } from './sketch';

export const GROWTH_MODELS = ['slow', 'fast'] as const;
export type GrowthModel = (typeof GROWTH_MODELS)[number];
export const DEFAULT_GROWTH_MODEL: GrowthModel = 'slow';

export const GROWTH_CHOICES: Readonly<
  Record<GrowthModel, Choice<GrowthModel> & { readonly note: string }>
> = {
  slow: {
    id: 'slow',
    label: 'Slow: embryos colliding over tens of millions of years',
    note: 'Planetary embryos collide in giant impacts long after the gas has gone, as N-body runs give (Chambers & Wetherill 1998) and the tungsten isotopes of Earth’s core suggest (Kleine et al. 2009). Drawn as an exponential: the share still to come falls by e every 11 million years.',
    source: 'Kleine et al. 2009, Geochimica et Cosmochimica Acta 73',
    url: 'https://doi.org/10.1016/j.gca.2008.11.047',
  },
  fast: {
    id: 'fast',
    label: 'Fast: pebbles swept up while the gas lasted',
    note: 'Earth sweeps up pebbles drifting through the gas disc and has most of its mass within a few million years (Johansen et al. 2021), as calcium isotopes suggest (Schiller et al. 2018). Drawn growing ever faster to 80% of the proto-Earth by about 4 million years, when the gas had gone, the rest by collisions after.',
    source: 'Johansen et al. 2021, Science Advances 7',
    url: 'https://doi.org/10.1126/sciadv.abc0444',
  },
};

/** The proto-Earth's share of today's mass just before the impact. */
export const PROTO_EARTH = 0.89;
/** The slow model's e-folding time, Myr. */
const SLOW_MYR = 11;
/** When the gas had gone, Myr after the first solids, and the fast model's share of it by then. */
const GAS_GONE_MYR = 4;
const BY_GAS_GONE = 0.8;
/** The smallest body drawn, Earth radii: a planetary embryo. */
const SMALLEST = 0.08;

/** Earth's mass as a share of today's, `myr` after the first solids, in `model`, before the impact. */
export function earthMass(model: GrowthModel, myr: number): number {
  if (myr <= 0) return 0;
  if (model === 'slow') return PROTO_EARTH * (1 - Math.exp(-myr / SLOW_MYR));
  if (myr < GAS_GONE_MYR) return PROTO_EARTH * BY_GAS_GONE * (myr / GAS_GONE_MYR) ** 3;
  const rest = 1 - Math.exp(-(myr - GAS_GONE_MYR) / SLOW_MYR);
  return PROTO_EARTH * (BY_GAS_GONE + (1 - BY_GAS_GONE) * rest);
}

/**
 * Earth's radius, as a share of today's, `myr` after the first solids, in `model`: as the cube
 * root of its mass (its rock as dense as today's), never smaller than an embryo drawn. A hit that
 * leaves a different share for the proto-Earth (#1220: two half-Earths) scales it to `proto`.
 */
export function earthRadius(model: GrowthModel, myr: number, proto = PROTO_EARTH): number {
  return Math.max(SMALLEST, Math.cbrt((earthMass(model, myr) * proto) / PROTO_EARTH));
}
