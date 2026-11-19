import { layer } from './layer';

/** Volcanoes erupting near the year shown (Smithsonian GVP). */
export const volcanoes = layer({
  id: 'volcanoes',
  label: 'Volcanic eruptions',
  about:
    'Eruptions dated near the year shown, sized by explosivity, from the Smithsonian’s Global Volcanism Program; tap one for its details.',
  spans: ['years'],
  reach: 'Eruptions of the last 11,700 years.',
});
