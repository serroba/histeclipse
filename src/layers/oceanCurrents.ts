import { layer } from './layer';
import { sealevel } from './sealevel';

/** The ocean's currents each month, drawn drifting as Windy draws the wind (#927). */
export const oceanCurrents = layer({
  id: 'oceanCurrents',
  label: 'Ocean currents',
  about:
    'The ocean’s currents each month since 1940, near the surface or at 1,500 m, drawn as streaks drifting with the water (IAP): the AMOC’s warm water north in the Gulf Stream, and its cold water south along the deep western boundary.',
  spans: ['years'],
  reach: 'From January 1940 to December 2021, a month at a time; after that, the last year’s.',
  covers: { years: [1940, 2021] },
  icon: sealevel.icon,
  why: 'oceanCurrents',
});
