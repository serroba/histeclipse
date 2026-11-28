/**
 * How long life took to come back after each extinction (#1269), as each study measured it: by
 * the variety of one group, of all marine genera, or of how ecosystems were built. Each figure
 * is as its study states it; where they differ, the list shows them side by side, quickest
 * first, rather than settling on one. The Late Devonian has none: no study found gives a time
 * for its seas' recovery.
 *
 * Pure.
 */

import type { LossRecovery, Recovery } from '../ownTime';

const TITLE = 'How long life took to come back, by what each study measured';

function recovery(...rows: (readonly [what: string, took: string, whose: string])[]): LossRecovery {
  return {
    title: TITLE,
    rows: rows.map(([what, took, whose]): Recovery => ({ what, took, whose })),
  };
}

export const RECOVERIES: Readonly<Record<string, LossRecovery>> = {
  'end-ordovician-extinction': recovery(
    [
      'Seafloor animals of Laurentia',
      'as varied as before within 5 million years',
      'Krug & Patzkowsky 2004',
    ],
    [
      'The sea’s variety in global compilations',
      'about 15 million years',
      'as Krug & Patzkowsky 2004 read them',
    ],
    ['Marine genera worldwide', 'not back for at least 35 million years', 'Rasmussen et al. 2019'],
  ),
  'end-permian-extinction': recovery(
    [
      'A sea community of modern kind, the Guiyang Biota',
      'found 1.08 million years after',
      'Dai et al. 2023',
    ],
    ['Ammonoids', 'more varied than before in under 2 million years', 'Brayard et al. 2009'],
    ['Marine genera', 'as many as before in about 5 million years', 'Song et al. 2018'],
    ['A stable, complex sea ecosystem', '8–9 million years', 'Chen & Benton 2012'],
    ['Communities of land animals', 'some 30 million years', 'Sahney & Benton 2008'],
    ['How sea ecosystems were built', 'about 50 million years', 'Song et al. 2018'],
  ),
  'end-triassic-extinction': recovery(
    ['Bivalves on the open seafloor', 'almost at once', 'Hautmann et al. 2008'],
    [
      'Bivalves of Britain’s shallow seas',
      'steady again by the first ammonite zone after',
      'Atkinson & Wignall 2019',
    ],
    ['The variety of ammonoid shapes', 'some 30 million years', 'Smith et al. 2014'],
    ['Reef corals', 'not until the Middle Jurassic’s Bajocian reefs', 'Lathuilière & Marchal 2009'],
  ),
  'k-pg-extinction': recovery(
    [
      'The sea’s algae',
      'productive again in possibly less than a century',
      'Sepúlveda et al. 2009',
    ],
    [
      'Life in the crater itself',
      'a productive ecosystem within 30,000 years',
      'Lowery et al. 2018',
    ],
    ['Mammals on land', 'twice as many kinds within about 100,000 years', 'Lyson et al. 2019'],
    ['Plankton communities', 'settled after 1.8 million years of swings', 'Alvarez et al. 2019'],
    [
      'Insects feeding on plants',
      'about 4 million years in Patagonia, 9 in North America',
      'Donovan et al. 2016',
    ],
  ),
};
