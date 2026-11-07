/**
 * What the deep-time map shows in each period, and the evidence particular to it: the part of
 * "How do we know?" that changes with the moment shown. Short and hedged where the sources
 * disagree; each rests on sources in the registry.
 *
 * Plain data, by the chart's period names; checked in periodEvidence.test.ts.
 */

import type { SourceId } from './registry';

export interface PeriodEvidence {
  /** What the map shows then, in a sentence. */
  readonly map: string;
  /** The evidence particular to the period. */
  readonly evidence: string;
  readonly sources: readonly SourceId[];
}

export const PERIOD_EVIDENCE: Readonly<Record<string, PeriodEvidence>> = {
  Ediacaran: {
    map: 'Rodinia has broken apart, and Gondwana is gathering in the south.',
    evidence:
      'The palaeomagnetic poles of this time scatter widely, and some read them as fast polar wander: reconstructions of it differ more than of any later time.',
    sources: ['torsvik2012', 'merdith2021'],
  },
  Cambrian: {
    map: 'Gondwana spans the southern hemisphere; Laurentia, Baltica and Siberia lie apart, near the equator.',
    evidence:
      'Trilobites differ from continent to continent, so their faunal provinces sort the blocks; palaeomagnetism gives each block’s latitude.',
    sources: ['torsvikCocks', 'torsvik2012'],
  },
  Ordovician: {
    map: 'The Iapetus Ocean narrows between Laurentia and Baltica; Gondwana drifts over the south pole.',
    evidence:
      'Glacial deposits across today’s Sahara record a short ice age at the end of the period, where the magnetism puts the south pole then.',
    sources: ['finnegan2011', 'torsvikCocks'],
  },
  Silurian: {
    map: 'Baltica and Avalonia close on Laurentia, and the Caledonian mountains rise where they meet.',
    evidence:
      'The same mountain belt and rock sequences run through Scandinavia, Scotland, Newfoundland and the Appalachians: one range then, split by the Atlantic since.',
    sources: ['torsvikCocks'],
  },
  Devonian: {
    map: 'Laurussia, the Old Red Sandstone continent, straddles the equator; Gondwana lies to the south across the Rheic Ocean.',
    evidence:
      'Red sandstones laid down by rivers in a warm, dry belt, and reefs, fit the latitudes the magnetism gives.',
    sources: ['torsvikCocks', 'boucot2013'],
  },
  Carboniferous: {
    map: 'Gondwana and Laurussia collide, raising the Variscan and Appalachian mountains: Pangaea is gathering.',
    evidence:
      'Coal from equatorial swamp forests in Europe and North America, and glacial deposits in South America, Africa, India, Antarctica and Australia: the late Palaeozoic ice age. Brought back together, those southern continents carry the traces of one great ice cover, as Wegener and du Toit argued.',
    sources: ['montanez2013', 'boucot2013'],
  },
  Permian: {
    map: 'Pangaea stands assembled from pole to pole; at the period’s end the Siberian Traps erupt.',
    evidence:
      'The Glossopteris flora spreads across every piece of Gondwana. The end-Permian extinction, dated to within tens of thousands of years by zircons in ash beds, falls in the time of the Siberian Traps.',
    sources: ['burgess2014', 'torsvikCocks'],
  },
  Triassic: {
    map: 'Pangaea at its fullest, with a hot, dry interior; it begins to rift at the period’s end.',
    evidence:
      'Lystrosaurus lies in Africa, India and Antarctica alike; red beds and salt mark the arid interior. The lavas of the first rifting, the Central Atlantic Magmatic Province, are dated to the end-Triassic extinction.',
    sources: ['blackburn2013', 'torsvikCocks'],
  },
  Jurassic: {
    map: 'The Central Atlantic opens between North America and Africa: Pangaea comes apart.',
    evidence:
      'The oldest ocean floor still in place, in the western Pacific, dates from this time: from here on the sea floor’s magnetic stripes record the spreading directly.',
    sources: ['seton2020', 'muller2019'],
  },
  Cretaceous: {
    map: 'The South Atlantic opens; India breaks away and moves fast to the north; at high sea level, shallow seas flood the continents.',
    evidence:
      'Sea-floor ages and magnetic stripes track each ocean’s opening; chalk and other marine rocks on today’s land record the flooding.',
    sources: ['seton2020', 'muller2019'],
  },
  Paleogene: {
    map: 'India meets Asia; Australia and South America draw away from Antarctica, which ices over from about 34 million years ago.',
    evidence:
      'When India and Asia first touched is still argued over, from about 65 to 40 million years ago by different measures. Oxygen isotopes in deep-sea shells record the cooling and Antarctica’s first ice.',
    sources: ['hu2016', 'zachos2001'],
  },
  Neogene: {
    map: 'The continents near their places today; the Himalaya and Tibet rise; the Isthmus of Panama forms.',
    evidence:
      'Plate motions are well measured by now. When Panama closed is argued over: about 3 million years ago, the classic date, or millions of years earlier.',
    sources: ['odea2016', 'muller2019'],
  },
  Quaternary: {
    map: 'The continents as today, as ice sheets grow and melt again and again.',
    evidence:
      'Ice and ocean-floor cores record each glacial cycle and the sea level that went with it: the ice-ages span shows them in detail.',
    sources: ['bintanja', 'spratt'],
  },
};
