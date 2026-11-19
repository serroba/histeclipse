import { layer } from './layer';

/** Eclipses (#634): the year's in the bar, and the one picked: the Moon's shadow and path, where the eclipsed Moon is up, the scrubber and the card. `lunar` and `solar` in older links read as this. */
export const eclipses = layer({
  id: 'eclipses',
  label: 'Eclipses',
  about:
    'The year’s eclipses in the bar, the famous ones and the records. For one picked: the Moon’s shadow and path on Earth, or where the eclipsed Moon was up, with its scrubber and card.',
  spans: ['years'],
  reach: 'In the years.',
  // The Sun nearly covered: a bright rim around a dark disc.
  icon: [
    'M12 7a5 5 0 1 0 0 10a5 5 0 1 0 0-10z',
    'M12 2.5v1.5',
    'M12 20v1.5',
    'M2.5 12H4',
    'M20 12h1.5',
    'M5.3 5.3l1 1',
    'M17.7 17.7l1 1',
    'M18.7 5.3l-1 1',
    'M6.3 17.7l-1 1',
  ],
  why: 'eclipses',
});
