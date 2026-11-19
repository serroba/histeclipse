import { layer } from './layer';

/** Named periods for the place picked (PeriodO), each by its source. */
export const periods = layer({
  id: 'periods',
  label: 'Named periods',
  about:
    'The archaeological and historical periods named for the place picked, each by its source (PeriodO).',
  spans: ['years'],
  reach: 'Periods of the last 11,700 years.',
  // An amphora: a period known by what people made.
  icon: [
    'M9.5 3h5',
    'M10 3v3c-3 1.5-4 4-4 7 0 3.5 2.5 6.5 6 8 3.5-1.5 6-4.5 6-8 0-3-1-5.5-4-7V3',
    'M8 6.5c-2 0-3 1-3 2.5',
    'M16 6.5c2 0 3 1 3 2.5',
  ],
  why: 'periods',
});
