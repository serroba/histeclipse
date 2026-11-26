import { PRESENT_YEAR } from '../time/present';
import { layer } from './layer';

/**
 * The nine planetary boundaries (#434), as a wheel beside the globe: where each stood in the
 * latest assessment of the year shown, Richardson et al. (2023) or the Planetary Health Check
 * 2026. Assessments, not a record through time: before the first, it draws nothing.
 */
export const boundaries = layer({
  id: 'boundaries',
  label: 'Planetary boundaries',
  summary: 'The nine planetary boundaries, and how far each is crossed.',
  about:
    'The nine Earth-system processes that keep the planet in a Holocene-like state, each with a boundary to human pressure, as a wheel beside the globe: where each control variable stood in the latest assessment of the year shown, inside its safe space, in the zone of increasing risk, or in the high-risk zone. From 2026 the Planetary Health Check 2026, with Richardson et al. (2023) beside it to compare; from 2023 to 2025, Richardson et al. alone.',
  spans: ['years'],
  reach: `Two assessments, not a record through time: Richardson et al. (2023), shown from 2023, and the Planetary Health Check 2026, from 2026 to ${String(PRESENT_YEAR)}.`,
  covers: { years: [2023, PRESENT_YEAR] },
  // A wheel: a ring, its hub, and wedges of different reach.
  icon: [
    'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z',
    'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'M12 3v6',
    'M19.8 16.5l-5.2-3',
    'M4.2 16.5l5.2-3',
  ],
  why: 'boundaries',
});
