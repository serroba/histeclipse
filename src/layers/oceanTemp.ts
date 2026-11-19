import { layer } from './layer';
import { sealevel } from './sealevel';

/** The ocean's temperature at the surface, 100 m and 700 m each month since 1940 (#590). */
export const oceanTemp = layer({
  id: 'oceanTemp',
  label: 'Ocean temperature',
  about:
    'The ocean’s temperature each month since 1940 at the surface, 100 m or 700 m, against the month’s 1991–2020 mean (IAP v4.2): warming going down, and El Niño’s warm water sliding east under the Pacific.',
  spans: ['years'],
  reach: 'From January 1940 to September 2026, a map a month at each depth.',
  covers: { years: [1940, 2026] },
  icon: sealevel.icon,
  why: 'oceanTemp',
});
