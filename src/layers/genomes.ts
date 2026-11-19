import { layer } from './layer';

/** Dated ancient genomes (AADR), counted by region around the year shown. */
export const genomes = layer({
  id: 'genomes',
  label: 'Ancient genomes',
  about:
    'Dated ancient DNA from the Allen Ancient DNA Resource (Reich lab), counted by region within 250 years.',
  spans: ['years'],
  reach: 'Genomes dated within the last 11,700 years, year by year.',
  // A double helix.
  icon: ['M7 3c0 4 10 5 10 9s-10 5-10 9', 'M17 3c0 4-10 5-10 9s10 5 10 9', 'M8.5 6h7', 'M8.5 18h7'],
  why: 'genomes',
});
