/**
 * The key facts pinned on the globe as an extinction's clock plays (#1268): each at a place, from
 * one moment to another, in a line, with whose study it is. Every number is one the clock's own
 * phases and records already give from the same studies; where they disagree, both are said.
 *
 * Pure.
 */

import { SOURCES, type SourceId } from '../../sources/registry';

const KYR = 1000 * 365.25 * 86_400;

/** A fact: its place (a site's id), from and until when, seconds since the extinction began. */
export interface KeyFact {
  readonly site: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly sources: readonly SourceId[];
}

function fact(
  site: string,
  [from, to]: readonly [number, number],
  text: string,
  sources: readonly SourceId[],
): KeyFact {
  return { site, from, to, text, sources };
}

/** The facts of each extinction, by its id: one at a place at a time. */
export const KEY_FACTS: Readonly<Record<string, readonly KeyFact[]>> = {
  'end-permian-extinction': [
    fact(
      'siberian-traps',
      [-300 * KYR, 0],
      'About two thirds of the lavas erupt before and during the extinction.',
      ['burgessBowring2015'],
    ),
    fact(
      'meishan',
      [0, 2 * KYR],
      'The extinction begins 251.941 ± 0.037 million years ago, dated by ash beds here.',
      ['burgess2014'],
    ),
    fact(
      'meishan',
      [2 * KYR, 40 * KYR],
      'More than 90% of the sea’s species lost, as usually quoted; some 81% by Stanley’s count.',
      ['burgessBowring2015', 'stanley2016'],
    ),
    fact('meishan', [40 * KYR, 75 * KYR], 'The sea’s surface warms by about 8 °C.', [
      'joachimski2012',
    ]),
    // Wu et al.'s plants grew in South China, not far from Meishan.
    fact(
      'meishan',
      [75 * KYR, 1000 * KYR],
      'Carbon dioxide rises about sixfold, to some 2,500 ppm; a model fitted to other records gives some 7,400.',
      ['wu2021', 'cui2021'],
    ),
    fact(
      'meishan',
      [5000 * KYR, Infinity],
      'Complex life in the sea returns only some five million years after the extinction.',
      ['chenBenton2012'],
    ),
  ],
  'end-triassic-extinction': [
    fact(
      'camp-palisades',
      [0, 44 * KYR],
      'The first lavas erupt as the extinction begins, 201.564 million years ago.',
      ['blackburn2013'],
    ),
    fact(
      'camp-palisades',
      [44 * KYR, 150 * KYR],
      'After the first lava here, carbon dioxide rises from about 2,000 to about 4,400 ppm.',
      ['schaller2011'],
    ),
    fact(
      'kuhjoch',
      [30 * KYR, 150 * KYR],
      'Between 33% and 73% of the sea’s genera lost: the counts differ widely.',
      ['bondGrasby2017'],
    ),
    fact(
      'camp-palisades',
      [150 * KYR, 1000 * KYR],
      'Its rocks lie on four continents: over 7 million km² as first mapped, over 10 million as known now.',
      ['marzoli1999', 'lindstrom2021'],
    ),
  ],
};

/** The facts showing at `seconds`, with whose they are, in words. */
export function factsAt<Fact extends KeyFact>(
  facts: readonly Fact[],
  seconds: number,
): readonly (Fact & { readonly whose: string })[] {
  return facts
    .filter((each) => each.from <= seconds && seconds < each.to)
    .map((each) => ({ ...each, whose: each.sources.map((id) => SOURCES[id].name).join('; ') }));
}
