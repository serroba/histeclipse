import { layer } from './layer';

/** Deep time: fossils of four groups of animals, where they lay then. */
export const fossils = layer({
  id: 'fossils',
  label: 'Fossils',
  about: 'Fossils of four groups of animals from the Paleobiology Database, where they lay then.',
  spans: ['all'],
  reach: 'Counted by 5 million years over the last 540 million.',
  // An ammonite's coil.
  icon: [
    'M12 20a8 8 0 1 1 8-8c0 3.5-2.7 6-6 6-2.8 0-5-2.2-5-5 0-2.2 1.8-4 4-4 1.7 0 3 1.3 3 3 0 1.1-.9 2-2 2',
  ],
  why: 'fossils',
});
