import { layer } from './layer';

/** Deep time: carbon dioxide and methane from the ice cores. */
export const air = layer({
  id: 'air',
  label: 'Air',
  summary: 'Carbon dioxide, methane and oxygen in the air through time.',
  about: 'Carbon dioxide and methane from the ice cores; carbon dioxide and oxygen from proxies.',
  spans: ['ice', 'all'],
  reach: 'Ice cores over 800,000 years; proxies over 540 million years.',
  // Wind.
  icon: ['M3 9h11a3 3 0 1 0-3-3', 'M3 14h15a3 3 0 1 1-3 3', 'M3 19h6'],
  boundary: 'climate',
  why: 'air',
});
