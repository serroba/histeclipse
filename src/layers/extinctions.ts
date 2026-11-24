import { layer } from './layer';

/** Deep time: the great mass extinctions, where their causes and records lay then (#1190). */
export const extinctions = layer({
  id: 'extinctions',
  label: 'Mass extinctions',
  summary: 'The great extinctions, and what caused them.',
  about:
    'The great mass extinctions, marked where their causes and records lay then; play slows as it passes each. Tap one for what it took and what the studies say caused it.',
  spans: ['all'],
  // The most severe, rather than the start of the span, where there is none.
  arrive: { ma: 251.9, label: 'the end-Permian' },
  reach: 'Six extinctions over the last 450 million years.',
  // A skull and crossbones.
  icon: [
    'M12 2.5a5.5 5.5 0 0 0-5.5 5.5c0 1.8.9 3.3 2.2 4.3v1.7h6.6v-1.7c1.3-1 2.2-2.5 2.2-4.3a5.5 5.5 0 0 0-5.5-5.5z',
    'M9.8 8.2h.01M14.2 8.2h.01',
    'M5 16.5l14 5M19 16.5l-14 5',
    'M4 15.6l.9 1M3.6 17.3l1.4-.8M20 15.6l-.9 1M20.4 17.3l-1.4-.8M4 22.4l.9-1M3.6 20.7l1.4.8M20 22.4l-.9-1M20.4 20.7l-1.4.8',
  ],
  why: 'extinctions',
});
