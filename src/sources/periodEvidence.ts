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

/** What the globe is before the surface maps: outlines back to 1.8 billion years, then sketches. */
const OUTLINED =
  'There are no surface maps this far back: the globe sketches competing hypotheses, and Plates outlines Cao et al.’s continents.';
const SKETCHED =
  'No reconstruction reaches this far back: the globe sketches what competing hypotheses say.';

export const PERIOD_EVIDENCE: Readonly<Record<string, PeriodEvidence>> = {
  Hadean: {
    map: `Earth forms, and the Moon with it; no rocks of this time survive. ${SKETCHED}`,
    evidence:
      'Grains of zircon about 4.4 billion years old, from the Jack Hills of Australia, carry hints of continental crust and liquid water; magnetism in such grains has been read as an early magnetic field, a reading that is argued over.',
    sources: ['wilde2001', 'tarduno2015'],
  },
  Eoarchean: {
    map: `The oldest surviving rocks; how much crust there was is not known. ${SKETCHED}`,
    evidence:
      'The Acasta Gneiss of northwestern Canada, about 4.03 billion years old, is among the oldest dated rocks on Earth.',
    sources: ['bowring1999'],
  },
  Paleoarchean: {
    map: `Small continents in a mostly ocean world. ${SKETCHED}`,
    evidence:
      'Stromatolite reefs about 3.43 billion years old in the Pilbara of Australia are among the oldest signs of life; magnetism in rocks of 3.4 to 3.45 billion years records a magnetic field already shielding Earth.',
    sources: ['allwood2006', 'tarduno2010'],
  },
  Mesoarchean: {
    map: `Continental crust grows in small cratons. ${SKETCHED}`,
    evidence:
      'Granite and greenstone terrains survive in Australia and southern Africa; whether plate tectonics as we know it had begun is argued over.',
    sources: ['bleeker2003'],
  },
  Neoarchean: {
    map: `The first large cratons form; whether they were ever joined in one supercontinent is not known. ${SKETCHED}`,
    evidence:
      'Some 35 pieces of Archean crust survive; fitting them into the wholes they came from is a puzzle with several answers.',
    sources: ['bleeker2003'],
  },
  Siderian: {
    map: `The Archean cratons, their arrangement not known; the air begins to gain oxygen. ${SKETCHED}`,
    evidence:
      'Sulfur isotopes lose a signal that forms only in air without oxygen around 2.4 billion years ago: the Great Oxidation Event. Glaciations of the time may be tied to it.',
    sources: ['farquhar2000'],
  },
  Rhyacian: {
    map: `After the Great Oxidation, with oxygen in the air to stay. ${SKETCHED}`,
    evidence:
      'Collisions that will build the supercontinent Nuna (Columbia) begin; their mountain belts of 2.1 to 1.8 billion years survive on every continent.',
    sources: ['farquhar2000', 'zhao2002'],
  },
  Orosirian: {
    map: `Continents collide to build Nuna (Columbia). ${SKETCHED}`,
    evidence:
      'Mountain belts of 2.1 to 1.8 billion years on every continent record the collisions that built it.',
    sources: ['zhao2002'],
  },
  Statherian: {
    map: `Nuna (Columbia) stands assembled. ${OUTLINED}`,
    evidence:
      'Its core, of Laurentia, Baltica and Siberia, is pinned together by palaeomagnetism; Cao et al.’s plate model, the one Plates outlines, begins at 1.8 billion years.',
    sources: ['evans2011', 'zhao2002', 'cao2024'],
  },
  Calymmian: {
    map: `Nuna slowly comes apart, in a long, quiet stretch some call the “boring billion”. ${OUTLINED}`,
    evidence:
      'Few new mountain belts, and little change in the rock record’s chemistry; palaeomagnetic poles are sparse, so maps of this time are among the least certain.',
    sources: ['evans2011'],
  },
  Ectasian: {
    map: `Nuna’s pieces drift; the quiet “boring billion” goes on. ${OUTLINED}`,
    evidence: 'Palaeomagnetic poles are still sparse; reconstructions of this time differ widely.',
    sources: ['evans2011', 'cao2024'],
  },
  Stenian: {
    map: `Rodinia assembles. ${OUTLINED}`,
    evidence:
      'The Grenville mountain belts, of about 1.1 to 0.9 billion years, run across several continents and mark the collisions that built Rodinia.',
    sources: ['li2008'],
  },
  Tonian: {
    map: `Rodinia holds most continents together, and begins to rift. ${OUTLINED}`,
    evidence:
      'Mountain belts of the same age and palaeomagnetic poles are the evidence; reconstructions of Rodinia differ over which pieces sat where.',
    sources: ['li2008'],
  },
  Cryogenian: {
    map: `Rodinia breaks up, and ice reaches the tropics twice. ${OUTLINED}`,
    evidence:
      'Glacial deposits laid down near the equator, by their magnetism, and capped by carbonates formed in warm water: the evidence for a “Snowball Earth”. How complete the ice was, a hard snowball or a slushball, is argued over; the globe sketches each.',
    sources: ['hoffman1998', 'hoffman2017'],
  },
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
