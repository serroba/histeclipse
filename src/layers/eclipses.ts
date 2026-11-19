import { layer } from './layer';

/** Eclipses (#634): the year's in the bar, and the one picked: the Moon's shadow and path, where the eclipsed Moon is up, the scrubber and the card. `lunar` and `solar` in older links read as this. */
export const eclipses = layer({
  id: 'eclipses',
  label: 'Eclipses',
  about:
    'The year’s eclipses in the bar, the famous ones and the records. For one picked: the Moon’s shadow and path on Earth, or where the eclipsed Moon was up, with its scrubber and card.',
  spans: ['years'],
  reach: 'In the years.',
});
