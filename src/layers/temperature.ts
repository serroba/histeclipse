import { layer } from './layer';

/**
 * Deep time only: the surface coloured by temperature. On the ice ages too, from land maps 2,000
 * years apart (#457); the span said so nowhere, so its chip told the reader to go elsewhere.
 */
export const temperature = layer({
  id: 'temperature',
  label: 'Temperature',
  summary: 'The surface coloured by its temperature.',
  about: 'The surface coloured by its temperature, model by model.',
  spans: ['ice', 'all', 'eons'],
  reach: 'Maps every 5 million years back 540 million years; on the ice ages, every 2,000 years.',
  covers: { oldestMa: 540 },
  // A thermometer.
  icon: ['M10 4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z', 'M12 9v7'],
  why: 'temperature',
});
