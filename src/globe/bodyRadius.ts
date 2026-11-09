/**
 * The radius of each body the camera can centre on, in Earth radii: the unit the scene draws
 * in, and the unit of a camera's distance once multiplied out.
 */

import type { Body } from '../state/viewState';
import { MOONS, type MoonName } from '../astro/moonOrbits';
import { moonRadius } from './moonLook';
import { planetRadius } from './planetLook';

const MOON_NAMES_LIST: readonly MoonName[] = Object.values(MOONS).flat();
import { MOON_RADIUS_EARTH_RADII, SUN_RADIUS_EARTH_RADII } from './spaceFrame';

export const BODY_RADIUS: Readonly<Record<Body, number>> = {
  earth: 1,
  moon: MOON_RADIUS_EARTH_RADII,
  sun: SUN_RADIUS_EARTH_RADII,
  mercury: planetRadius('mercury'),
  venus: planetRadius('venus'),
  mars: planetRadius('mars'),
  jupiter: planetRadius('jupiter'),
  saturn: planetRadius('saturn'),
  ...(Object.fromEntries(MOON_NAMES_LIST.map((moon) => [moon, moonRadius(moon)])) as Record<
    MoonName,
    number
  >),
};
