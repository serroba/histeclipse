import { layer } from './layer';

/** Deep time only: the surface coloured by temperature, and sea level through time. */
export const temperature = layer({
  id: 'temperature',
  label: 'Temperature',
  about: 'The surface coloured by its temperature, model by model.',
  spans: ['all', 'eons'],
  reach: 'Maps every 5 million years, back 540 million years.',
  covers: { oldestMa: 540 },
});
