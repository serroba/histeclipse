import { layer } from './layer';

/** Named periods for the place picked (PeriodO), each by its source. */
export const periods = layer({
  id: 'periods',
  label: 'Named periods',
  about:
    'The archaeological and historical periods named for the place picked, each by its source (PeriodO).',
  spans: ['years'],
  reach: 'Periods of the last 11,700 years.',
});
