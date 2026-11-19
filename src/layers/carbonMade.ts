import { layer } from './layer';

/** What radiocarbon cannot reach, and what dates older things instead. */
export const CARBON_LIMIT =
  'After about 50,000 years too little carbon-14 is left to measure, so older things are dated by other clocks, such as potassium–argon and uranium–lead.';

/** Where cosmic rays make carbon-14, by latitude, for a field and a Sun (Kovaltsov et al. 2012). */
export const carbonMade = layer({
  id: 'carbonMade',
  label: 'Carbon-14 made in the sky',
  about:
    'Where cosmic rays make carbon-14, high in the air: most over the poles, where Earth’s magnetic field shields least. Try another field or Sun, and follow it into living things.',
  spans: ['years', 'ice'],
  reach: `${CARBON_LIMIT} Drawn on the Years and Ice ages spans, for the last 50,000 years.`,
});
