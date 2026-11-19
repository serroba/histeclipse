import { layer } from './layer';

/** Deep time: a second reconstruction's continents, outlined. */
export const plates = layer({
  id: 'plates',
  label: 'Plates',
  about: 'A second reconstruction’s continents, outlined over the first.',
  spans: ['ice', 'all', 'eons'],
  reach: 'Back to 1,800 million years ago.',
  covers: { oldestMa: 1800 },
});
