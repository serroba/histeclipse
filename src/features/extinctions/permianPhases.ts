/**
 * What the end-Permian's clock says happened, and when (#1192): from the first losses on land,
 * argued to have come long before the sea's, through the Siberian Traps' lavas and sills, the
 * extinction itself, to the slow recovery millions of years on. Each phase from the time its
 * studies place it, counted from the extinction's start at Meishan (251.941 Ma, Burgess, Bowring
 * & Shen 2014), with those studies; where they disagree, each side.
 *
 * Pure.
 */

import { phase, type EventPhase } from '../ownTime';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;

export const END_PERMIAN: readonly EventPhase[] = [
  phase(
    'land',
    -400 * KYR,
    'On land, earlier? It is argued',
    'Pangaea, late in the Permian. In Australia the Glossopteris forests collapsed before 252.3 million years ago, some 370,000 years before the sea’s extinction (Fielding et al.); in South Africa’s Karoo the change of animals long held to mark it is over 300,000 years older too (Gastaldo et al.). The usual view had land and sea dying together.',
    ['fielding2019', 'gastaldo2020'],
  ),
  phase(
    'lavas',
    -300 * KYR,
    'The Siberian Traps erupt',
    'Flood lavas pour over Siberia, among the largest eruptions since animals arose. About two thirds of them come out before and during the extinction, over some 300,000 years.',
    ['burgessBowring2015'],
  ),
  phase(
    'warming',
    -10 * KYR,
    'The seas warm',
    'Just before the main extinction, the tropical sea’s surface warms by about 8 °C, as light carbon from the Siberian Traps and what they heated pours into the air.',
    ['joachimski2012'],
  ),
  phase(
    'sills',
    0,
    'Sills bake the rocks: the gas',
    'As the extinction begins, the magma spreads underground in sills through coal and evaporites, and the heat drives off carbon dioxide, methane and halocarbons through hundreds of vents; sulfur, chlorine and fluorine come with the magma itself.',
    ['burgess2017', 'svensen2009', 'black2012'],
  ),
  phase(
    'dying',
    2 * KYR,
    'The Great Dying',
    'In at most 61,000 ± 48,000 years, more than 90% of the sea’s species and 75% of the land’s are lost, as usually quoted; some 81% of the sea’s once the extinction already under way is counted apart (Stanley). In the sea, heat and loss of oxygen together explain most of the losses, and where they fell hardest.',
    ['burgessBowring2015', 'stanley2016', 'burgess2014', 'penn2018'],
  ),
  phase(
    'acid',
    40 * KYR,
    'The oceans acidify',
    'The first pulse of extinction came with a slow release of carbon, and the sea’s pH held. In the second, a rapid, large release acidified the sea abruptly, killing above all the life with heavy shells.',
    ['clarkson2015'],
  ),
  phase(
    'carbon',
    75 * KYR,
    'Six times the carbon dioxide, or thirteen? It is argued',
    'From fossil plants, carbon dioxide rises from some 430 to some 2,500 ppm within about 75,000 years, and the volcanoes’ own gas was probably not enough: carbon from organic matter and methane, which the Siberian Traps released, was likely needed too (Wu et al.). From an Earth-system model fitted to carbon isotopes, ocean pH and temperatures, it rises from some 440 to some 7,390 ppm, about 36,000 billion tonnes of carbon, mostly the volcanoes’ own (Cui et al.).',
    ['wu2021', 'cui2021'],
  ),
  phase(
    'hothouse',
    1000 * KYR,
    'A lethally hot world',
    'In the Early Triassic the tropical seas near 40 °C. Fish, many marine reptiles and calcareous algae are all but missing from the equator, and the land there was likely hotter still.',
    ['sun2012'],
  ),
  phase(
    'recovery',
    5000 * KYR,
    'Recovery, step by step',
    'Life comes back slowly, held back by repeated crises, and complex ecosystems return only some five million years on, in the Middle Triassic.',
    ['chenBenton2012'],
  ),
];
