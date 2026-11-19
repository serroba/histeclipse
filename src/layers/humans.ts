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
  // A person.
  icon: ['M12 4a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z', 'M8 21v-6l-2-1 2-4h8l2 4-2 1v6', 'M12 15v6'],
  why: 'humans',
});
