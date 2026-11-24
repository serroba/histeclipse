/**
 * What the end-Guadalupian's clock says happened, and when (#1201): the Emeishan Traps erupting
 * into the sea in southwest China as the extinction began, there recorded together in the same
 * rocks. Counted from the extinction's start.
 *
 * Pure.
 */

import { phase, type EventPhase } from '../ownTime';

const YEAR = 365.25 * 86_400;
const KYR = 1000 * YEAR;

export const END_GUADALUPIAN: readonly EventPhase[] = [
  phase(
    'sixth',
    -400 * KYR,
    'A sixth great extinction? It is argued',
    'Late in the Middle Permian, eight million years before the end-Permian. Usually left out of the five, it is put forward as a sixth by the genera lost, and above all by its effect on ecosystems.',
    ['rampinoShen2019', 'bambach2006'],
  ),
  phase(
    'eruptions',
    0,
    'Eruptions into the sea, and the extinction',
    'In southwest China the first Emeishan eruptions explode through the sea as steam and ash, and in the same rocks the large foraminifers and calcareous algae die out with them.',
    ['wignall2009'],
  ),
  phase(
    'carbon',
    100 * KYR,
    'The carbon cycle upset',
    'Only after the extinction does a large shift in carbon isotopes come, a sign of the carbon cycle severely disturbed.',
    ['wignall2009'],
  ),
  phase(
    'basalts',
    500 * KYR,
    'The flood basalts',
    'The Emeishan basalts cover some 300,000 km² of the Yangtze Block’s western margin, erupted within three million years at most.',
    ['shellnutt2014'],
  ),
];
