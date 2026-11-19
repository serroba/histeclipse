import { layer } from './layer';

export const sealevel = layer({
  id: 'sealevel',
  label: 'Sea level',
  about: 'Sea level through time, as each reconstruction has it, on a chart.',
  spans: ['ice', 'all', 'eons'],
  reach: 'Reconstructions in deep time.',
  // Waves.
  icon: ['M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0', 'M3 19h18'],
  why: 'sealevel',
});
