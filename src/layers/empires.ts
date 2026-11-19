import { layer } from './layer';

export const empires = layer({
  id: 'empires',
  label: 'States and empires',
  about:
    'Borders from Cliopatria or OpenHistoricalMap, or both to compare: OpenHistoricalMap’s names in italics, and a state both name nearby named once, underlined with dots.',
  spans: ['years'],
  reach: 'From 3400 BCE (Cliopatria) or 4000 BCE (OpenHistoricalMap) to today.',
  // A flag on its pole: a state's claim.
  icon: ['M5 21V4', 'M5 4h12l-2.5 4 2.5 4H5'],
  why: 'empires-cliopatria',
});
