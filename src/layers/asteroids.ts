import { layer } from './layer';

/** The main belt's asteroids at least 100 km across, going round the Sun (#372). */
export const asteroids = layer({
  id: 'asteroids',
  label: 'Asteroid belt',
  summary: 'The largest asteroids, circling the Sun between Mars and Jupiter.',
  about:
    'The main belt’s asteroids at least 100 km across, some two hundred, going round the Sun between Mars and Jupiter; the largest named, a tap on a name for its card.',
  spans: ['years'],
  reach: 'In the years: where each is, closely from 1600 to 2500, roughly beyond.',
  // A lumpy rock, and two small ones.
  icon: ['M6 9l3-4 5 1 3 4-1 4-4 2-4-1-2-3z', 'M18.5 17.5h.01', 'M5 19h.01', 'M20 6h.01'],
  why: 'asteroids',
});
