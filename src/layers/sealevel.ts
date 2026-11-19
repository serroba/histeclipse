import { layer } from './layer';

export const sealevel = layer({
  id: 'sealevel',
  label: 'Sea level',
  about: 'Sea level through time, as each reconstruction has it, on a chart.',
  spans: ['ice', 'all', 'eons'],
  reach: 'Reconstructions in deep time.',
});
