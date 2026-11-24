import { layer } from './layer';

/** Deep time: the great mass extinctions, where their causes and records lay then (#1190). */
export const extinctions = layer({
  id: 'extinctions',
  label: 'Mass extinctions',
  summary: 'The great extinctions, and what caused them.',
  about:
    'The great mass extinctions, marked where their causes and records lay then; play slows as it passes each. Tap one for what it took and what the studies say caused it.',
  spans: ['all'],
  reach: 'Six extinctions over the last 450 million years.',
  // A skull.
  icon: [
    'M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4.4 3 5.6V19h8v-3.4c1.8-1.2 3-3.2 3-5.6a7 7 0 0 0-7-7z',
    'M9.5 10.5h.01M14.5 10.5h.01',
    'M10 19v2M14 19v2',
  ],
  why: 'extinctions',
});
