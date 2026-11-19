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
});
