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

/** A moon's mission map: the size shown, a sharper one for close up, and its credit. */
export interface MoonMap {
  readonly map: string;
  readonly sharp: string | null;
  readonly caption: string;
}

const GALILEO = 'Galileo’s and Voyager’s images, mosaicked by USGS Astrogeology';
const CASSINI_DLR =
  'mosaicked by DLR (Roatsch and others) via USGS Astrogeology, its brightness evened out across the globe';

/** A moon's map: 2048 pixels wide, and `sharp` wide close up (none if null). */
function moonMap(moon: MoonName, sharp: number | null, caption: string): MoonMap {
  return {
    map: `textures/moons/${moon}-2048.jpg`,
    sharp: sharp === null ? null : `textures/moons/${moon}-${String(sharp)}.jpg`,
    caption: `Pictured: ${caption}`,
  };
}

/**
 * The moons with a mission's global map (`pipeline planet-maps`), all public domain. Deimos has
 * none fit to use, and Hyperion, tumbling and lumpy, none at all: they keep their colour.
 */
export const MOON_MAPS: Readonly<Partial<Record<MoonName, MoonMap>>> = {
  phobos: moonMap(
    'phobos',
    null,
    'the Viking orbiters’ images (1976–80), mosaicked by Phil Stooke and controlled by DLR. Phobos is not round: wrapped on a sphere, its map is stretched. NASA/USGS.',
  ),
  io: moonMap(
    'io',
    4096,
    `${GALILEO}, in colour; nothing was seen within some 5° of the poles. NASA/JPL/USGS.`,
  ),
  europa: moonMap(
    'europa',
    4096,
    `${GALILEO}; black near the south pole, which they did not see. NASA/JPL/USGS.`,
  ),
  ganymede: moonMap(
    'ganymede',
    4096,
    `${GALILEO}; black at the poles, which they did not see. NASA/JPL/USGS.`,
  ),
  callisto: moonMap(
    'callisto',
    4096,
    `${GALILEO}; black near the south pole, which they did not see. NASA/JPL/USGS.`,
  ),
  mimas: moonMap(
    'mimas',
    4096,
    'Cassini’s map of Mimas (June 2012), Voyager’s images filling its gaps. NASA/JPL-Caltech/Space Science Institute.',
  ),
  enceladus: moonMap(
    'enceladus',
    4096,
    'Cassini’s images, mosaicked by USGS Astrogeology (Bland, Becker and others). NASA/JPL-Caltech/SSI/USGS.',
  ),
  tethys: moonMap('tethys', 4096, `Cassini’s images, ${CASSINI_DLR}. NASA/JPL-Caltech/SSI/DLR.`),
  dione: moonMap(
    'dione',
    4096,
    `Cassini’s and Voyager’s images, ${CASSINI_DLR}. NASA/JPL-Caltech/SSI/DLR.`,
  ),
  rhea: moonMap(
    'rhea',
    4096,
    `Cassini’s and Voyager’s images, ${CASSINI_DLR}. NASA/JPL-Caltech/SSI/DLR.`,
  ),
  titan: moonMap(
    'titan',
    4040,
    'Cassini’s view of the ground in near infrared, through the haze that hides it from the eye (2015); grey where it saw too little. NASA/JPL-Caltech/Space Science Institute, via USGS.',
  ),
  iapetus: moonMap(
    'iapetus',
    4096,
    `Cassini’s and Voyager’s images, ${CASSINI_DLR}, which hides most of the contrast between its dark and bright sides. NASA/JPL-Caltech/SSI/DLR.`,
  ),
};
