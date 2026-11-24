/**
 * What the end-Ordovician's and the Late Devonian's clocks say happened, and when (#1202): two
 * pulses each, counted from the first, each phase from the time its studies place it, with
 * those studies; where they disagree, each side.
 *
 * Pure.
 */

import { phase, type EventPhase } from '../ownTime';

const KYR = 1000 * 365.25 * 86_400;

export const END_ORDOVICIAN: readonly EventPhase[] = [
  phase(
    'warm',
    -1000 * KYR,
    'Warm seas, and ice in the south',
    'Late in the Ordovician the tropical seas are 32 to 37 °C, yet ice sheets already cover much of Gondwana, then over the South Pole.',
    ['finnegan2011'],
  ),
  phase(
    'first',
    0,
    'The first pulse: the ice at its greatest? It is argued',
    'The tropics cool by about 5 °C, the ice grows at least as large as in the last ice age, and the seas fall; many groups lose their habitats and die out (Finnegan et al.; Harper et al.). Bond & Grasby read it otherwise: mercury from an unknown large volcanic province, warming and oxygen-poor water, not the cold, drove both pulses.',
    ['finnegan2011', 'finnegan2012', 'harper2014', 'bondGrasby2020'],
  ),
  phase(
    'second',
    1000 * KYR,
    'The second pulse: warming, and water without oxygen',
    'A million years later, as the ice melts, oxygen-poor water spreads from the deep onto the shelves and productivity collapses. Between the two pulses some 85% of species are gone.',
    ['harper2014', 'bondGrasby2020'],
  ),
  phase(
    'silurian',
    2000 * KYR,
    'Into the Silurian',
    'Ice lingers into the early Silurian, but never again as large; the survivors rebuild the seas’ life.',
    ['finnegan2011', 'harper2014'],
  ),
];

export const LATE_DEVONIAN: readonly EventPhase[] = [
  phase(
    'forests',
    -1000 * KYR,
    'The first forests',
    'Trees and seed plants spread over the land, their deeper roots and soils speeding weathering and washing nutrients into the seas: a long Devonian crisis for the tropical reefs is under way.',
    ['algeoScheckler1998'],
  ),
  phase(
    'volcanoes',
    -300 * KYR,
    'Volcanoes? It is argued',
    'Mercury enriched worldwide points to volcanism, the Viluy Traps in Siberia the usual suspect, dated near the crisis; how it drove the changes is still more question than answer.',
    ['racki2020', 'ricci2013'],
  ),
  phase(
    'lower',
    0,
    'The lower Kellwasser: oxygen-poor seas',
    'The sea rises, and water without oxygen spreads over the shelves, leaving black shales.',
    ['bondWignall2008', 'deVleeschouwer2017'],
  ),
  phase(
    'cooling',
    300 * KYR,
    'The tropics cool',
    'Twice the tropical seas cool by 5 to 7 °C as carbon is buried and CO₂ falls; the warm shallow seas’ life, used to the heat, suffers most.',
    ['joachimskiBuggisch2002'],
  ),
  phase(
    'upper',
    600 * KYR,
    'The upper Kellwasser: the reefs collapse',
    '600,000 years after the first, the second pulse of oxygen-poor water, at the Frasnian–Famennian boundary. Its timing follows Earth’s orbit, as in later crises: the reef builders are hit hardest.',
    ['deVleeschouwer2017', 'bondWignall2008'],
  ),
];
