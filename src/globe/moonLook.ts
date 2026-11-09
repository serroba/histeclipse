/**
 * The moons of Mars, Jupiter and Saturn drawn (#335): their names, sizes and planets.
 */

import { MOONS, type MoonName, type MoonPlanet } from '../astro/moonOrbits';
import { EARTH_RADIUS_KM } from './spaceFrame';

/** Mean radii, km, as JPL gives them (Solar System Dynamics, planetary satellite physical parameters). */
export const MOON_RADIUS_KM: Readonly<Record<MoonName, number>> = {
  phobos: 11.08,
  deimos: 6.2,
  io: 1821.49,
  europa: 1560.8,
  ganymede: 2631.2,
  callisto: 2410.3,
  mimas: 198.2,
  enceladus: 252.1,
  tethys: 531.1,
  dione: 561.4,
  rhea: 763.5,
  titan: 2574.76,
  hyperion: 135.0,
  iapetus: 734.3,
};

export const MOON_NAMES: Readonly<Record<MoonName, string>> = {
  phobos: 'Phobos',
  deimos: 'Deimos',
  io: 'Io',
  europa: 'Europa',
  ganymede: 'Ganymede',
  callisto: 'Callisto',
  mimas: 'Mimas',
  enceladus: 'Enceladus',
  tethys: 'Tethys',
  dione: 'Dione',
  rhea: 'Rhea',
  titan: 'Titan',
  hyperion: 'Hyperion',
  iapetus: 'Iapetus',
};

const MOON_LIST: readonly string[] = Object.values(MOONS).flat();
/** Whether a body is one of the planets' moons drawn. */
export function isMoonBody(body: string): body is MoonName {
  return MOON_LIST.includes(body);
}

/** The planet each moon goes round. */
export function moonPlanet(moon: MoonName): MoonPlanet {
  return moon === 'phobos' || moon === 'deimos'
    ? 'mars'
    : (MOONS.jupiter as readonly string[]).includes(moon)
      ? 'jupiter'
      : 'saturn';
}

/** A moon's radius, Earth radii: the scene's unit. */
export function moonRadius(moon: MoonName): number {
  return MOON_RADIUS_KM[moon] / EARTH_RADIUS_KM;
}
