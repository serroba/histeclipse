import { layer } from './layer';

/** The orbits of Earth and the planets, seen from far out or from the Sun or a planet. */
export const orbits = layer({
  id: 'orbits',
  label: 'Planets’ orbits',
  about:
    'The paths of Earth and the five bright planets around the Sun, drawn when the view is far out or on the Sun or a planet.',
  spans: ['years'],
  reach: 'In the years, seen from far out.',
});
