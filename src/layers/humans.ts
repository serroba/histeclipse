import { layer } from './layer';

/** Deep time: dated finds of our species and its relatives. */
export const humans = layer({
  id: 'humans',
  label: 'Humans',
  about:
    'Dated finds of our species and its relatives, with competing dates side by side, and dispersal models.',
  spans: ['ice'],
  reach: 'Finds of the last few hundred thousand years.',
  // The earliest Homo sapiens, Jebel Irhoud's 281–349 ka (Hublin et al. 2017), as the
  // milestone has it.
  arrive: { ma: 0.315, label: 'the earliest Homo sapiens' },
});
