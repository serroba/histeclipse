import { layer } from './layer';

export const empires = layer({
  id: 'empires',
  label: 'States and empires',
  about:
    'Borders from Cliopatria or OpenHistoricalMap, or both to compare: OpenHistoricalMap’s names in italics, and a state both name nearby named once, underlined with dots.',
  spans: ['years'],
  reach: 'From 3400 BCE (Cliopatria) or 4000 BCE (OpenHistoricalMap) to today.',
});
