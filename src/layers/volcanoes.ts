import { layer } from './layer';

/** Volcanoes erupting near the year shown (Smithsonian GVP). */
export const volcanoes = layer({
  id: 'volcanoes',
  label: 'Volcanic eruptions',
  summary: 'Volcanic eruptions near the year shown.',
  about:
    'Eruptions dated near the year shown, sized by explosivity, from the Smithsonian’s Global Volcanism Program; tap one for its details.',
  spans: ['years'],
  reach: 'Eruptions of the last 11,700 years.',
  // A volcano with its plume.
  icon: ['M3 20l6-10h6l6 10z', 'M10 10l1.5 2 1.5-2', 'M12 7c-1-1.5 0-3 1.5-3s2.5 1.5 4 0'],
  why: 'volcanoes',
});
