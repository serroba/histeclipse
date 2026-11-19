import { layer } from './layer';

/** The orbits of Earth and the planets, seen from far out or from the Sun or a planet. */
export const orbits = layer({
  id: 'orbits',
  label: 'Planets’ orbits',
  about:
    'The paths of Earth and the five bright planets around the Sun, drawn when the view is far out or on the Sun or a planet.',
  spans: ['years'],
  reach: 'In the years, seen from far out.',
  // An ellipse round a centre, with a body on it.
  icon: [
    'M12 6.5c5 0 9 2.5 9 5.5s-4 5.5-9 5.5-9-2.5-9-5.5 4-5.5 9-5.5z',
    'M12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2z',
    'M19.5 8.5h.01',
  ],
  why: 'orbits',
});
