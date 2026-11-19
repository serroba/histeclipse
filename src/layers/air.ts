import { layer } from './layer';

/** Deep time: carbon dioxide and methane from the ice cores. */
export const air = layer({
  id: 'air',
  label: 'Air',
  about: 'Carbon dioxide and methane from the ice cores; carbon dioxide and oxygen from proxies.',
  spans: ['ice', 'all'],
  reach: 'Ice cores over 800,000 years; proxies over 540 million years.',
});
