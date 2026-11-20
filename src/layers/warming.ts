import { layer } from './layer';
import { temperature } from './temperature';

/** Global surface temperature since 1850, every record side by side (#526). */
export const warming = layer({
  id: 'warming',
  label: 'Warming since 1850',
  summary: 'Global temperature since 1850, from six records.',
  about:
    'Global surface temperature since 1850, six records side by side beside the globe (HadCRUT5, Berkeley Earth, NOAAGlobalTemp, GISTEMP, ERA5, JRA-3Q), and how far apart they are.',
  spans: ['years'],
  reach: 'From 1850 to 2025, on the 1850–1900 baseline; each record from its own start.',
  covers: { years: [1850, 2025] },
  icon: temperature.icon,
  why: 'warming',
});
