import { layer } from './layer';

/**
 * The Sun's small bodies that are large or that matter (#372, #1329): the main belt's asteroids
 * and Jupiter's Trojans at least 100 km across, and a chosen few nearer and farther.
 */
export const asteroids = layer({
  id: 'asteroids',
  label: 'Asteroids and dwarf planets',
  summary: 'The largest asteroids and the dwarf planets, each where it is around the Sun.',
  about:
    'The main belt’s asteroids and Jupiter’s Trojans at least 100 km across, some two hundred and thirty, with a few near-Earth asteroids, the centaurs among the giant planets, and the largest bodies beyond Neptune: Pluto, Eris, Haumea, Makemake and others; the largest named, a tap on a name for its card.',
  spans: ['years'],
  reach:
    'In the years: where each is, closely within the years its orbit is fitted to (1600 to 2500 for most), roughly beyond.',
  // A lumpy rock, and two small ones.
  icon: ['M6 9l3-4 5 1 3 4-1 4-4 2-4-1-2-3z', 'M18.5 17.5h.01', 'M5 19h.01', 'M20 6h.01'],
  why: 'asteroids',
});
