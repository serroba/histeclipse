import { layer } from './layer';

/** Deep time only: the surface coloured by temperature, and sea level through time. */
export const temperature = layer({
  id: 'temperature',
  label: 'Temperature',
  about: 'The surface coloured by its temperature, model by model.',
  spans: ['all', 'eons'],
  reach: 'Maps every 5 million years, back 540 million years.',
  covers: { oldestMa: 540 },
  // A thermometer.
  icon: ['M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z', 'M12 9v7'],
  why: 'temperature',
});
