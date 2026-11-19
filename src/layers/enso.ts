import { layer } from './layer';
import { sealevel } from './sealevel';

/** El Niño and La Niña since 1950, NOAA's two indices side by side (#886). */
export const enso = layer({
  id: 'enso',
  label: 'El Niño and La Niña',
  about:
    'The tropical Pacific each month since 1950, as NOAA’s two indices measure it (RONI, official since 2026, and ONI before it), and before then by ours from two reconstructions of the sea, side by side beside the globe, and where they disagree; on the globe from 1981, the month’s sea surface temperature against normal (OISST), or what El Niño and La Niña usually do to rain (GPCP) and temperature (Berkeley Earth), by either index.',
  spans: ['years'],
  reach:
    'From January 1950 to September 2026 by NOAA’s indices, a value a month; from 1854 to 1949 by ours, from ERSST and HadISST.',
  covers: { years: [1854, 2026] },
  icon: sealevel.icon,
  why: 'enso',
});
