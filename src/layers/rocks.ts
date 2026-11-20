import { layer } from './layer';

/** The rocks at the surface today and how old they are (Macrostrat). */
export const rocks = layer({
  id: 'rocks',
  label: 'Rocks at the surface',
  summary: 'How old the rocks at the surface are.',
  about:
    'How old the rocks at the surface are, from Macrostrat; pick a place to see its rock, then the Earth when it formed.',
  spans: ['years'],
  reach: 'Today’s surface, shown in the years.',
  // Strata, one bent.
  icon: ['M3 7c4-2 8 2 12 0s4-1 6-1', 'M3 12c4-2 8 2 12 0s4-1 6-1', 'M3 17h18', 'M3 21h18'],
  why: 'rocks',
});
