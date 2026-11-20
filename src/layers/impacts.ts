import { layer } from './layer';

/** Impact craters and deposits (Impact Earth), in either time: where they lay then. */
export const impacts = layer({
  id: 'impacts',
  label: 'Impact craters',
  summary: 'Craters left by asteroids and comets.',
  about:
    'Craters and deposits left by asteroids and comets, from the Impact Earth Database; tap one for its details.',
  spans: ['years', 'ice', 'all'],
  reach: 'Where they lie today, or where the plates had them, back 540 million years.',
  // A meteor striking.
  icon: ['M3 3l9 9', 'M7 3l7 7', 'M3 7l7 7', 'M16 13a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'],
  why: 'impacts',
});
