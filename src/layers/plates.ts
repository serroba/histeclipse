import { layer } from './layer';

/** Deep time: a second reconstruction's continents, outlined. */
export const plates = layer({
  id: 'plates',
  label: 'Plates',
  summary: 'A second reconstruction’s continents, to compare with the first.',
  about: 'A second reconstruction’s continents, outlined over the first.',
  spans: ['ice', 'all', 'eons'],
  reach: 'Back to 1,800 million years ago.',
  covers: { oldestMa: 1800 },
  // A globe split by a plate boundary.
  icon: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M5 7l4 3-1 4 4 2 1 5', 'M13 3.2l1 4.8 4 1.5'],
  why: 'plates',
});
