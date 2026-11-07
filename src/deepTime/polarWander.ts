/**
 * True polar wander: the whole solid Earth turning beneath its spin axis, as against the plates
 * moving over the mantle. The reconstructions hold the spin axis still, so such a turn shows only
 * as every continent moving together. These are the episodes the site names, each with the
 * studies that found it and those that question it; the size of each is the studies' own.
 */

import type { SourceId } from '../sources/registry';

export interface PolarWanderEpisode {
  readonly name: string;
  /** Youngest and oldest edges, Ma: the span the studies give. */
  readonly young: number;
  readonly old: number;
  /** What was found, in words, with its authors. */
  readonly found: string;
  /** How it is questioned, in words, with its authors. */
  readonly questioned: string;
  readonly sources: readonly SourceId[];
}

/** Youngest first. */
export const POLAR_WANDER: readonly PolarWanderEpisode[] = [
  {
    name: 'Late Cretaceous oscillation',
    young: 78,
    old: 86,
    found:
      'Seamount poles of the Pacific plate fall into two groups 16–21° apart, both about 84 Ma (Sager & Koppers 2000); limestones in Italy record a ~12° swing and back between 86 and 78 Ma (Mitchell et al. 2021).',
    questioned:
      'Long debated: classic records from the same Italian limestone, the Scaglia Rossa, were the main argument against it (as Mitchell et al. 2021 note).',
    sources: ['sagerKoppers2000', 'mitchell2021'],
  },
  {
    name: 'Jurassic “monster” polar shift',
    young: 145,
    old: 160,
    found:
      'About 30° between roughly 160 and 145 Ma, at ~2.5° per million years: as fast as true polar wander is thought able to go (Kent et al. 2015; Muttoni & Kent 2019).',
    questioned:
      'Some compilations of poles show a smooth path instead of a jump; how much is true polar wander rather than plate motion is argued (Kent et al. 2015 call it “apparent (or true)”).',
    sources: ['kent2015', 'muttoniKent2019'],
  },
  {
    name: 'Cambrian inertial interchange',
    young: 497,
    old: 538.8,
    found:
      'All the continents turning about 90° together in the Early to Middle Cambrian, proposed from fast continental motions (Kirschvink et al. 1997).',
    questioned:
      'Questioned at once in a published comment (Torsvik, Meert & Smethurst 1998); the data are sparse and still argued over.',
    sources: ['kirschvink1997', 'torsvik1998'],
  },
];

/** The episode under way `ma` million years ago, if any. */
export function polarWanderAt(ma: number): PolarWanderEpisode | null {
  return POLAR_WANDER.find(({ young, old }) => ma >= young && ma <= old) ?? null;
}
