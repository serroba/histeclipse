import { layer } from './layer';

/** The rocks at the surface today and how old they are (Macrostrat). */
export const rocks = layer({
  id: 'rocks',
  label: 'Rocks at the surface',
  about:
    'How old the rocks at the surface are, from Macrostrat; pick a place to see its rock, then the Earth when it formed.',
  spans: ['years'],
  reach: 'Today’s surface, shown in the years.',
});
