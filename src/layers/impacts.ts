import { layer } from './layer';

/** Impact craters and deposits (Impact Earth), in either time: where they lay then. */
export const impacts = layer({
  id: 'impacts',
  label: 'Impact craters',
  about:
    'Craters and deposits left by asteroids and comets, from the Impact Earth Database; tap one for its details.',
  spans: ['years', 'ice', 'all'],
  reach: 'Where they lie today, or where the plates had them, back 540 million years.',
});
