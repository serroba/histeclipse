import { PRESENT_YEAR } from '../time/present';
import { layer } from './layer';

/** Every craft sent beyond Earth orbit, flying as the time plays (#350). */
export const spacecraft = layer({
  id: 'spacecraft',
  label: 'Spacecraft',
  about:
    'Every craft sent beyond Earth orbit since 1959, where it was at the moment shown, flying as the time plays; a tap on its name for its story.',
  spans: ['years'],
  reach: 'In the years, from Luna 1 in January 1959 to today.',
  covers: { years: [1959, PRESENT_YEAR] },
  // A probe: its body, its panels, and its dish.
  icon: ['M10 10h4v4h-4z', 'M3 11h7M14 11h7M3 9v4M21 9v4', 'M12 10V6', 'M9 5a3 3 0 0 0 6 0'],
  why: 'spacecraft',
});
