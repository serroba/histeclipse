/**
 * What the end-Triassic's clock says happened, and when (#1201): the Central Atlantic Magmatic
 * Province from its first intrusions to its last pulse, and the extinction with it, each phase
 * from the time its studies place it, counted from the extinction's start, with the earliest
 * lavas (Blackburn et al. 2013).
 *
 * Pure.
 */

import { phase, type EventPhase } from '../ownTime';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;

export const END_TRIASSIC: readonly EventPhase[] = [
  phase(
    'pangaea',
    -400 * KYR,
    'Pangaea begins to break',
    'Late in the Triassic, rifts open through the middle of Pangaea, where North America, Africa and South America meet: where the Atlantic will be.',
    ['marzoli1999'],
  ),
  phase(
    'intrusions',
    -100 * KYR,
    'Magma underground first',
    'Some 100,000 years before the first lavas, magma is already intruding the crust, and the climate and life begin to change with it.',
    ['davies2017'],
  ),
  phase(
    'eruptions',
    0,
    'The lavas, and the extinction',
    'The first flood lavas erupt as the extinction begins. In Brazil, sills spread through organic-rich rocks at the same time, their gas adding to the volcanoes’. Each eruption lasts a few centuries, carrying carbon dioxide from deep below, as much as this century’s projected human emissions.',
    ['blackburn2013', 'davies2017', 'capriolo2020'],
  ),
  phase(
    'methane',
    5 * KYR,
    'A burst of carbon, and warming',
    'Within 10,000 to 20,000 years, at least 12,000 billion tonnes of light carbon, as methane, reach the air; the land warms and the rains grow heavier. Up to half the sea’s species are lost.',
    ['ruhl2011'],
  ),
  phase(
    'carbon',
    30 * KYR,
    'Carbon dioxide doubles, and falls back',
    'After the first lavas carbon dioxide rises from about 2,000 to about 4,400 ppm, then falls back over 300,000 years as fresh basalt weathers; the next two pulses do the same.',
    ['schaller2011'],
  ),
  phase(
    'pulses',
    150 * KYR,
    'Four pulses',
    'The province erupts in four pulses over about 600,000 years, still erupting as life recovers. Its rocks are found today on four continents, over more than 7 million km² as first mapped (Marzoli et al.), over more than 10 million as known now (Lindström et al.).',
    ['blackburn2013', 'marzoli1999', 'lindstrom2021'],
  ),
  phase(
    'jurassic',
    1000 * KYR,
    'The age of dinosaurs',
    'With their rivals gone, the dinosaurs come to dominate the land for the next 136 million years, and the Atlantic opens where the lavas poured out.',
    ['blackburn2013', 'marzoli1999'],
  ),
];
