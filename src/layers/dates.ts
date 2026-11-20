import { layer } from './layer';

/** Archaeological radiocarbon dates (p3k14c), calibrated, by cell and 250 years. */
export const dates = layer({
  id: 'dates',
  label: 'Radiocarbon dates',
  summary: 'Where archaeologists have dated remains by carbon-14.',
  about:
    'Where archaeologists have dated remains by carbon-14 (p3k14c), calibrated and counted by square and 250 years: where dates were measured, not how many people lived. Pick a place to see how one was dated.',
  spans: ['years'],
  reach: 'From 10,550 BCE (12,500 years before 1950) to 1950.',
  covers: { years: [-10549, 1950] },
  // A grid of squares, some filled: dates counted by cell.
  icon: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M15 15h4v4h-4z'],
  why: 'dates',
});
