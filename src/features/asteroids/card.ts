/**
 * An asteroid's card (#372): its size, its orbit, and how well its place is known: within the
 * years its orbit is fitted to JPL's, as closely as the fit came; outside them, only roughly.
 */

import type { AsteroidOrbit } from './orbits';
import type { MarkerCardContent } from '../../ui/markerCard';

const KM_PER_AU = 149_597_870.7;
const DAYS_PER_YEAR = 365.25;

export function asteroidCard(
  asteroid: AsteroidOrbit & { readonly number: string },
  fitted: readonly [number, number],
  jdTT: number,
): MarkerCardContent {
  const au = asteroid.axisKm / KM_PER_AU;
  const years = 360 / asteroid.longitude[1] / DAYS_PER_YEAR;
  const within = jdTT >= fitted[0] && jdTT <= fitted[1];
  return {
    title: asteroid.name,
    facts: [
      ['Across', `${Math.round(asteroid.diameterKm).toLocaleString('en-GB')} km`],
      [
        'Orbit',
        `${au.toFixed(2)} AU from the Sun on average, once round every ${years.toFixed(1)} years`,
      ],
      ['Minor planet', `number ${asteroid.number}`],
      [
        'Where',
        within
          ? `Within ${asteroid.offDegrees.toFixed(1)}° of JPL’s place along its orbit, seen from the Sun`
          : 'Roughly: its orbit is fitted to JPL’s from 1600 to 2500 and carried on; this far from those years, where it is along its orbit is not well known',
      ],
    ],
    links: [
      {
        label: 'JPL Small-Body Database',
        href: `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${asteroid.number}`,
      },
    ],
    note: 'Size and orbit: JPL’s Small-Body Database; where it is: a mean orbit fitted to JPL Horizons.',
  };
}
